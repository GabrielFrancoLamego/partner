import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canReviewCompletedShiftClosings } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { awardXp, getInternalProgramRules } from "@/lib/gamification"
import { notifyUser } from "@/lib/notifications"
import { computePendingTimeclockAdjustments } from "@/lib/timeclock-adjustments"
import { maybeDistributeGoalReward } from "@/lib/goal-rewards"
import { isCompanyClosedOn } from "@/lib/company-calendar"

/** Avisa todo Master da empresa quando a Gerente fecha o expediente atrasado (depois do shiftClosingDeadline). */
async function notifyMastersOfLateClosing(companyId: string, closedByName: string, date: Date) {
  const masters = await prisma.user.findMany({
    where: { companyId, role: "COMPANY_MASTER", status: "ACTIVE" },
    select: { id: true, email: true, phone: true },
  })
  const dateLabel = date.toLocaleDateString("pt-BR")
  await Promise.all(
    masters.map((m) =>
      notifyUser({
        userId: m.id,
        email: m.email,
        phone: m.phone,
        type: "GENERIC",
        title: "Fechamento de expediente atrasado",
        message: `${closedByName} fechou o expediente de ${dateLabel} depois do horário-limite.`,
        linkUrl: "/company/fechamento",
      }).catch(() => {}),
    ),
  )
}

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
 * Sequência obrigatória de fechamento — os passos que precisam estar
 * completos antes de liberar o botão "Finalizar Expediente" (ver POST abaixo,
 * que reforça a mesma regra no servidor):
 *   0. Confirmar (ou perdoar, com justificativa) cada variação de ponto do
 *      dia calculada pelo relógio — atraso, saída diferente, intervalo
 *      excedido (ver lib/timeclock-adjustments.ts). Nada é aplicado sem essa
 *      confirmação da Gerente/Master.
 *   1. Todas as Commission de hoje com Valor da Conta preenchido (amount).
 *   2. Nota diária de todos os colaboradores presentes hoje (com TimeEntry).
 *   3. Faturamento total + foto do comprovante (checado pelo `closing` já existente).
 */
async function getClosingChecklist(companyId: string, date: Date) {
  const end = new Date(date.getTime() + 24 * 60 * 60 * 1000)

  const [pendingCommissions, presentEmployeeIds, evaluatedEmployeeIds, pendingTimeclockAdjustments] = await Promise.all([
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
    computePendingTimeclockAdjustments(companyId, date),
  ])

  const evaluatedSet = new Set(evaluatedEmployeeIds.map((e) => e.employeeId))
  const presentIds = Array.from(new Set(presentEmployeeIds.map((e) => e.userId)))
  const pendingEmployeeIds = presentIds.filter((id) => !evaluatedSet.has(id))
  const pendingEmployees =
    pendingEmployeeIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: pendingEmployeeIds } }, select: { id: true, name: true } })
      : []

  return {
    pendingTimeclockAdjustments,
    pendingCommissions,
    pendingEmployees,
    step0Complete: pendingTimeclockAdjustments.length === 0,
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
    // Rascunho — grava o preenchimento parcial (revenueAmount/summary/foto, se
    // já tiver) sem exigir a sequência completa nem marcar COMPLETED. Só
    // "Concluir e Enviar Fechamento" (isDraft ausente/false) de fato finaliza.
    const isDraft = formData.get("isDraft") === "true"

    const date = startOfDay(dateRaw && typeof dateRaw === "string" ? new Date(dateRaw) : new Date())
    const now = new Date()

    // Sequência obrigatória — reforça no servidor o que a UI já bloqueia:
    // passos 0, 1 e 2 têm que estar 100% completos antes do passo 3 (faturamento + foto).
    // Só exigido quando não é rascunho.
    const checklist = await getClosingChecklist(companyId, date)
    if (!isDraft) {
      if (!checklist.step0Complete) {
        throw new ApiError(400, "Confirme a variação de ponto de todos os colaboradores hoje antes de finalizar o expediente")
      }
      if (!checklist.step1Complete) {
        throw new ApiError(400, "Confirme o valor da conta de todos os clientes indicados hoje antes de finalizar o expediente")
      }
      if (!checklist.step2Complete) {
        throw new ApiError(400, "Avalie todos os colaboradores presentes hoje antes de finalizar o expediente")
      }
    }

    const existing = await prisma.shiftClosing.findUnique({ where: { companyId_date: { companyId, date } } })

    // Fechamento já submetido (COMPLETED) só pode ser corrigido pelo Master —
    // a Gerente perde a permissão de edição (inclusive rascunho) assim que o expediente é finalizado.
    if (existing?.status === "COMPLETED" && !canReviewCompletedShiftClosings(user.role)) {
      throw new ApiError(403, "Este fechamento já foi submetido. Apenas o Master pode corrigi-lo.")
    }

    if (!isDraft && (!(file instanceof File) || file.size === 0)) {
      if (!existing?.receiptUrl) throw new ApiError(400, "Foto do comprovante de fechamento do caixa é obrigatória")
    }

    const receiptUrl = file instanceof File && file.size > 0 ? await uploadImage("closings", file) : existing?.receiptUrl ?? null

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true } })
    // Override do Master = fechou depois do prazo OU está corrigindo um fechamento já COMPLETED (a Gerente não pode mais mexer nele).
    const isMasterOverride =
      !isDraft && user.role === "COMPANY_MASTER" && (isPastDeadline(date, company.shiftClosingDeadline, now) || existing?.status === "COMPLETED")
    // Atrasado independe de quem fechou — a Gerente pode (e deve) fechar mesmo
    // depois do prazo em vez de ficar bloqueada; só avisamos o Master.
    const isLate = !isDraft && isPastDeadline(date, company.shiftClosingDeadline, now)

    const closing = await prisma.shiftClosing.upsert({
      where: { companyId_date: { companyId, date } },
      update: {
        revenueAmount: revenueAmount ? Number(revenueAmount) : null,
        receiptUrl,
        summary: typeof summary === "string" ? summary.trim() || null : null,
        ...(isDraft ? {} : { status: "COMPLETED", isMasterOverride, isLate, closedById: user.id, closedAt: now }),
      },
      create: {
        companyId,
        date,
        revenueAmount: revenueAmount ? Number(revenueAmount) : null,
        receiptUrl,
        summary: typeof summary === "string" ? summary.trim() || null : null,
        status: isDraft ? "PENDING_GERENTE" : "COMPLETED",
        isMasterOverride,
        isLate,
        closedById: isDraft ? null : user.id,
        closedAt: isDraft ? null : now,
      },
      include: { closedBy: { select: { id: true, name: true } } },
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: isDraft ? "DRAFT" : isMasterOverride ? "MASTER_OVERRIDE" : existing ? "UPDATE" : "CREATE",
      entity: "ShiftClosing",
      entityId: closing.id,
      details: { date, revenueAmount, isDraft },
    })

    if (isDraft) {
      return Response.json(closing, { status: 201 })
    }

    // Fechamento atrasado feito pela Gerente (não pelo Master) — avisa o
    // Master imediatamente, sem esperar ele notar sozinho no dashboard.
    if (isLate && user.role === "COMPANY_GERENTE") {
      await notifyMastersOfLateClosing(companyId, user.name, date)
    }

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
        await maybeDistributeGoalReward(goal.id, companyId, user.id).catch(() => {})
      }
    }

    // Fechar o dia varre os checklists que ficaram sem NENHUMA entrega (nunca
    // chegaram a SUBMITTED) e os marca como não executados, penalizando XP —
    // tarefas já entregues e aguardando double-check da Gerente não são afetadas.
    // Colaborador com FALTA ou uso de BANCO_HORAS registrado hoje fica isento
    // — não é penalizado por não cumprir checklist numa ausência já autorizada.
    const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    const companyClosedToday = await isCompanyClosedOn(companyId, date)
    const exemptOccurrences = await prisma.occurrence.findMany({
      where: { companyId, date: { gte: date, lt: dayEnd }, type: { in: ["FALTA", "BANCO_HORAS"] }, employeeId: { not: null } },
      select: { employeeId: true },
    })
    const exemptEmployeeIds = new Set(exemptOccurrences.map((o) => o.employeeId!))

    // Dia CLOSED do Calendário Operacional (ver /company/configuracoes) — a
    // empresa não abriu, então nenhuma tarefa pendente é penalizada por "não
    // entrega" (ensureTodayChecklistInstances já nem gera instâncias novas
    // nesses dias, mas um dia que virou CLOSED depois de já ter instâncias
    // criadas precisa dessa segunda camada de proteção).
    // Tarefa compartilhada (FREE/SECTOR/TAG) que ninguém reservou não tem um
    // responsável pra penalizar/notificar — ainda assim fica marcada REJECTED
    // pra não ficar PENDING pra sempre, só sem XP nem notificação.
    const strandedChecklists = companyClosedToday
      ? []
      : (
          await prisma.checklist.findMany({
            where: { companyId, forDate: date, status: "PENDING" },
          })
        ).filter((c) => c.employeeId === null || !exemptEmployeeIds.has(c.employeeId))
    if (strandedChecklists.length > 0) {
      const rules = await getInternalProgramRules(companyId)
      await prisma.$transaction(async (tx) => {
        for (const checklist of strandedChecklists) {
          await tx.checklist.update({
            where: { id: checklist.id },
            data: {
              status: "REJECTED",
              rejectionReason: checklist.employeeId ? "Fechamento do dia sem entrega" : "Ninguém reservou esta tarefa hoje",
              approvedById: user.id,
              approvedAt: now,
            },
          })
          if (checklist.employeeId && rules.pointsChecklistFail !== 0) {
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

      // Clareza para o colaborador: sem isso, uma tarefa que nunca foi
      // entregue vira "não entregue" silenciosamente no fechamento do dia.
      await Promise.all(
        strandedChecklists
          .filter((checklist) => checklist.employeeId)
          .map((checklist) =>
          notifyUser({
            userId: checklist.employeeId!,
            type: "GENERIC",
            title: `Checklist "${checklist.title}" marcado como não entregue`,
            message: `O expediente foi fechado sem nenhuma entrega desta tarefa${
              rules.pointsChecklistFail !== 0 ? ` — ${rules.pointsChecklistFail} pontos.` : "."
            }`,
            linkUrl: "/company/checklists",
          }).catch(() => {}),
        ),
      )
    }

    return Response.json(closing, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
