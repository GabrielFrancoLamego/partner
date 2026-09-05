import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"

/**
 * Progresso ao vivo das metas do dia — soma Commission.amount (faturamento das
 * comandas já escaneadas no PDV) desde 00:00, independente de status/aprovação,
 * já que a meta é sobre venda realizada, não sobre comissão liberada.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [tiers, revenueAgg] = await Promise.all([
      prisma.revenueGoalTier.findMany({ where: { companyId }, orderBy: { order: "asc" } }),
      prisma.commission.aggregate({ where: { companyId, date: { gte: startOfToday } }, _sum: { amount: true } }),
    ])

    const currentRevenue = Number(revenueAgg._sum.amount ?? 0)
    const sorted = [...tiers].sort((a, b) => Number(a.targetAmount) - Number(b.targetAmount))

    let currentTier: (typeof sorted)[number] | null = null
    let nextTier: (typeof sorted)[number] | null = null
    for (const tier of sorted) {
      if (currentRevenue >= Number(tier.targetAmount)) currentTier = tier
      else {
        nextTier = tier
        break
      }
    }

    const floor = currentTier ? Number(currentTier.targetAmount) : 0
    const ceiling = nextTier ? Number(nextTier.targetAmount) : floor
    const progressToNextPercent = nextTier
      ? Math.max(0, Math.min(100, Math.round(((currentRevenue - floor) / (ceiling - floor)) * 100)))
      : 100

    return Response.json({
      currentRevenue,
      tiers: sorted,
      currentTier,
      nextTier,
      progressToNextPercent,
      remainingToNext: nextTier ? Math.max(0, Number(nextTier.targetAmount) - currentRevenue) : 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
