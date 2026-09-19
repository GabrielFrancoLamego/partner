import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { awardXp, getInternalProgramRules } from "@/lib/gamification"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** `now` está depois do horário-limite (HH:mm) da empresa para o dia de `reference`. */
function isPastDeadline(reference: Date, deadline: string, now: Date) {
  const [h, m] = deadline.split(":").map(Number)
  const cutoff = new Date(reference)
  cutoff.setHours(h, m, 0, 0)
  return now > cutoff
}

/**
 * Sequência obrigatória de fechamento — os 3 passos que precisam estar
 * completos antes de liberar o botão "Finalizar Expediente" (ver POST abaixo,
 * que reforça a mesma regra no servidor):
 *   1. Todas as Commission de hoje com Valor da Conta preenchido (amount).
 *   2. Nota diária de todos os colaboradores presentes hoje (com TimeEntry).
 *   3. Faturamento total + foto do comprovante (checado pelo `closing` já existente).
 */
async function getClosingChecklist(companyId: string, date: Date) {
  const end = new Date(date.getTime() + 24 * 60 * 60 * 1000)

  const [pendingCommissions, presentEmployeeIds, evaluatedEmployeeIds] = await Promise.all([
    prisma.commission.findMany({
      where: { companyId, date: { gte: date, lt: end }, amount: null },
      select: { id: true, clientName: true, commissionValue: true, partner: { select: { name: true } } },
    }),
    prisma.timeEntry.findMany({
      where: { companyId, type: "CHECK_IN", createdAt: { gte: date, lt: end } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.dailyEvaluation.findMany({ where: { companyId, date }, select: { employeeId: true } }),
  ])

  const evaluatedSet = new Set(evaluatedEmployeeIds.map((e) => e.employeeId))
  const presentIds = Array.from(new Set(presentEmployeeIds.map((e) => e.userId)))
  const pendingEmployeeIds = presentIds.filter((id) => !evaluatedSet.has(id))
  const pendingEmployees =
    pendingEmployeeIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: pendingEmployeeIds } }, select: { id: true, name: true } })
      : []

  return {
    pendingCommissions,
    pendingEmployees,
    step1Complete: pendingCommissions.length === 0,
    step2Complete: pendingEmployees.length === 0,
  }
}

/** Status do fechamento do dia — visível a todo o staff da empresa (dashboard do Master usa isso para o alerta). */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const date = startOfDay(dateParam ? new Date(dateParam) : new Date())
    const now = new Date()

    const [closing, company, checklist] = await Promise.all([
      prisma.shiftClosing.findUnique({
        where: { companyId_date: { companyId, date } },
        include: { closedBy: { select: { id: true, name: true } } },
      }),
      prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true, createdAt: true } }),
      getClosingChecklist(companyId, date),
    ])

    const overdue = !closing || closing.status !== "COMPLETED" ? isPastDeadline(date, company.shiftClosingDeadline, now) : false

    // "Não bloqueia o sistema": mesmo com o dia de hoje já rolado, o caixa de
    // dias anteriores sem fechamento continua sinalizado até ser regularizado.
    const fourteenDaysAgo = new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000)
    const searchStart = new Date(Math.max(fourteenDaysAgo.getTime(), startOfDay(company.createdAt).getTime()))
    const completedPastClosings = await prisma.shiftClosing.findMany({
      where: { companyId, date: { gte: searchStart, lt: date }, status: "COMPLETED" },
      select: { date: true },
    })
    const completedDates = new Set(completedPastClosings.map((c) => c.date.toISOString()))
    const unclosedPastDays: string[] = []
    for (let d = new Date(searchStart); d < date; d.setDate(d.getDate() + 1)) {
      const day = startOfDay(d)
      if (!completedDates.has(day.toISOString())) unclosedPastDays.push(day.toISOString())
    }

    return Response.json({
      date,
      deadline: company.shiftClosingDeadline,
      closing,
      overdue,
      canOverride: overdue && user.role === "COMPANY_MASTER",
      unclosedPastDays,
      checklist,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const formData = await request.formData()
    const dateRaw = formData.get("date")
    const revenueAmount = formData.get("revenueAmount")
    const summary = formData.get("summary")
    const file = formData.get("file")

    const date = startOfDay(dateRaw && typeof dateRaw === "string" ? new Date(dateRaw) : new Date())
    const now = new Date()

    // Sequência obrigatória — reforça no servidor o que a UI já bloqueia:
    // passos 1 e 2 têm que estar 100% completos antes do passo 3 (faturamento + foto).
    const checklist = await getClosingChecklist(companyId, date)
    if (!checklist.step1Complete) {
      throw new ApiError(400, "Confirme o valor da conta de todos os clientes indicados hoje antes de finalizar o expediente")
    }
    if (!checklist.step2Complete) {
      throw new ApiError(400, "Avalie todos os colaboradores presentes hoje antes de finalizar o expediente")
    }

    const existing = await prisma.shiftClosing.findUnique({ where: { companyId_date: { companyId, date } } })
    if (!(file instanceof File) || file.size === 0) {
      if (!existing?.receiptUrl) throw new ApiError(400, "Foto do comprovante de fechamento do caixa é obrigatória")
    }

    const receiptUrl = file instanceof File && file.size > 0 ? await uploadImage("closings", file) : existing?.receiptUrl ?? null

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true } })
    const isMasterOverride = user.role === "COMPANY_MASTER" && isPastDeadline(date, company.shiftClosingDeadline, now)

    const closing = await prisma.shiftClosing.upsert({
      where: { companyId_date: { companyId, date } },
      update: {
        revenueAmount: revenueAmount ? Number(revenueAmount) : null,
        receiptUrl,
        summary: typeof summary === "string" ? summary.trim() || null : null,
        status: "COMPLETED",
        isMasterOverride,
        closedById: user.id,
        closedAt: now,
      },
      create: {
        companyId,
        date,
        revenueAmount: revenueAmount ? Number(revenueAmount) : null,
        receiptUrl,
        summary: typeof summary === "string" ? summary.trim() || null : null,
        status: "COMPLETED",
        isMasterOverride,
        closedById: user.id,
        closedAt: now,
      },
      include: { closedBy: { select: { id: true, name: true } } },
    })

    // Sincroniza com toda meta ativa COMPANY+DAILY: o fechamento do caixa É o
    // resultado do dia para essas metas, sem exigir lançamento duplicado.
    if (revenueAmount) {
      const dailyCompanyGoals = await prisma.goal.findMany({
        where: { companyId, scope: "COMPANY", period: "DAILY", active: true },
        select: { id: true },
      })
      for (const goal of dailyCompanyGoals) {
        await prisma.goalRecord.upsert({
          where: { goalId_date: { goalId: goal.id, date } },
          update: { amount: Number(revenueAmount), receiptUrl: receiptUrl ?? undefined, reportedById: user.id },
          create: { goalId: goal.id, date, amount: Number(revenueAmount), receiptUrl, reportedById: user.id },
        })
      }
    }

    await logAudit({
      userId: user.id,
      companyId,
      action: isMasterOverride ? "MASTER_OVERRIDE" : "CREATE",
      entity: "ShiftClosing",
      entityId: closing.id,
      details: { date, revenueAmount },
    })

    // Fechar o dia varre os checklists que ficaram sem NENHUMA entrega (nunca
    // chegaram a SUBMITTED) e os marca como não executados, penalizando XP —
    // tarefas já entregues e aguardando double-check da Gerente não são afetadas.
    const strandedChecklists = await prisma.checklist.findMany({
      where: { companyId, forDate: date, status: "PENDING" },
    })
    if (strandedChecklists.length > 0) {
      const rules = await getInternalProgramRules(companyId)
      await prisma.$transaction(async (tx) => {
        for (const checklist of strandedChecklists) {
          await tx.checklist.update({
            where: { id: checklist.id },
            data: {
              status: "REJECTED",
              rejectionReason: "Fechamento do dia sem entrega",
              approvedById: user.id,
              approvedAt: now,
            },
          })
          if (rules.pointsChecklistFail !== 0) {
            const hasEmployeeProfile = await tx.employeeProfile.findUnique({ where: { userId: checklist.employeeId } })
            if (hasEmployeeProfile) {
              await awardXp(
                {
                  companyId,
                  employeeId: checklist.employeeId,
                  reason: "CHECKLIST_ON_TIME",
                  points: rules.pointsChecklistFail,
                  sourceId: checklist.id,
                  note: "Fechamento do dia sem entrega",
                },
                tx,
              )
            }
          }
        }
      })
    }

    return Response.json(closing, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
