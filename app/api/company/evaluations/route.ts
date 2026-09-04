import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { awardXp } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

/** Nota fora da faixa neutra [-1, 1] exige justificativa por escrito. */
const NEUTRAL_BAND = 1
/** Conversão nota diária -> XP: cada ponto de nota vale 5 XP (pode ser negativo). */
const XP_PER_POINT = 5

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Rotina diária da Gerente: todos os colaboradores + nota do dia (se já lançada). */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const date = startOfDay(dateParam ? new Date(dateParam) : new Date())

    const employees = await prisma.user.findMany({
      where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        dailyEvaluationsReceived: {
          where: { date },
          select: { id: true, score: true, justification: true, evaluatedBy: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    })

    return Response.json(
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        evaluation: e.dailyEvaluationsReceived[0] ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { employeeId, dateRaw, score: scoreRaw, justification } = body as {
      employeeId: string
      dateRaw?: string
      score: number
      justification?: string
    }

    if (!employeeId) throw new ApiError(400, "Colaborador é obrigatório")
    const score = Number(scoreRaw)
    if (Number.isNaN(score)) throw new ApiError(400, "Nota inválida")
    if ((score > NEUTRAL_BAND || score < -NEUTRAL_BAND) && !justification?.trim()) {
      throw new ApiError(400, "Justificativa é obrigatória para notas fora da faixa -1 a 1")
    }

    const employee = await prisma.user.findFirst({ where: { id: employeeId, companyId, role: "EMPLOYEE" } })
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const date = startOfDay(dateRaw ? new Date(dateRaw) : new Date())

    const evaluation = await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyEvaluation.findUnique({ where: { employeeId_date: { employeeId, date } } })

      const saved = await tx.dailyEvaluation.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: {
          companyId,
          employeeId,
          date,
          score,
          justification: justification?.trim() || null,
          evaluatedById: user.id,
        },
        update: { score, justification: justification?.trim() || null, evaluatedById: user.id },
      })

      // Reaplicar XP: remove o lançamento anterior desta avaliação (se houver) antes de creditar o novo valor
      if (existing) {
        const previousEntry = await tx.xpEntry.findFirst({
          where: { sourceId: existing.id, reason: "DAILY_EVALUATION" },
        })
        if (previousEntry) {
          await tx.xpEntry.delete({ where: { id: previousEntry.id } })
          await tx.employeeProfile.update({
            where: { userId: employeeId },
            data: { xpPoints: { decrement: previousEntry.points } },
          })
        }
      }

      const xpDelta = Math.round(score * XP_PER_POINT)
      if (xpDelta !== 0) {
        await awardXp(
          { companyId, employeeId, reason: "DAILY_EVALUATION", points: xpDelta, sourceId: saved.id },
          tx,
        )
      }

      return saved
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: "UPSERT",
      entity: "DailyEvaluation",
      entityId: evaluation.id,
      details: { employeeId, score },
    })

    return Response.json(evaluation, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
