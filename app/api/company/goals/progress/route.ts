import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { currentPeriodWindow } from "@/lib/goal-period"

/**
 * Progresso de cada meta ativa visível ao usuário, no período CORRENTE —
 * mensal/trimestral/semestral/anual são sempre a SOMA dos GoalRecord diários
 * dentro da janela do período (nunca um valor solto), então uma meta mensal
 * reflete automaticamente todo fechamento diário já registrado no mês.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const isManager = canManageDailyOperations(user.role)

    let where: Record<string, unknown> = { companyId, active: true }
    if (!isManager) {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { sectorId: true } })
      where = {
        companyId,
        active: true,
        OR: [{ scope: "COMPANY" }, { scope: "EMPLOYEE", employeeId: user.id }, ...(profile?.sectorId ? [{ scope: "SECTOR", sectorId: profile.sectorId }] : [])],
      }
    }

    const goals = await prisma.goal.findMany({
      where,
      include: {
        tiers: { orderBy: { order: "asc" }, include: { rewardCatalogItem: { select: { id: true, name: true } } } },
        sector: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const results = await Promise.all(
      goals.map(async (goal) => {
        const window = currentPeriodWindow(goal.period)
        const agg = await prisma.goalRecord.aggregate({
          where: { goalId: goal.id, date: { gte: window.start, lt: window.end } },
          _sum: { amount: true },
        })
        const currentAmount = Number(agg._sum.amount ?? 0)
        const sortedTiers = [...goal.tiers].sort((a, b) => Number(a.targetAmount) - Number(b.targetAmount))

        let currentTier: (typeof sortedTiers)[number] | null = null
        let nextTier: (typeof sortedTiers)[number] | null = null
        for (const tier of sortedTiers) {
          if (currentAmount >= Number(tier.targetAmount)) currentTier = tier
          else {
            nextTier = tier
            break
          }
        }

        const floor = currentTier ? Number(currentTier.targetAmount) : 0
        const ceiling = nextTier ? Number(nextTier.targetAmount) : floor
        const progressToNextPercent = nextTier ? Math.max(0, Math.min(100, Math.round(((currentAmount - floor) / (ceiling - floor)) * 100))) : 100

        return {
          id: goal.id,
          name: goal.name,
          scope: goal.scope,
          period: goal.period,
          sector: goal.sector,
          employee: goal.employee,
          tiers: sortedTiers,
          currentAmount,
          currentTier,
          nextTier,
          progressToNextPercent,
          remainingToNext: nextTier ? Math.max(0, Number(nextTier.targetAmount) - currentAmount) : 0,
          windowStart: window.start,
          windowEnd: window.end,
        }
      }),
    )

    return Response.json(results)
  } catch (error) {
    return handleApiError(error)
  }
}
