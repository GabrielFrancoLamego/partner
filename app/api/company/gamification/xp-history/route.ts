import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { getMonthlyScore, getServiceFeeAdjustment, getServiceFeeTiersSorted } from "@/lib/gamification"

/** Extrato de XP do mês corrente — usado no modal "Extrato Detalhado" e no card "Projeção de Ganhos" do Dashboard do Colaborador. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [entries, monthlyScore, serviceFeeAdjustment, allTiers, program] = await Promise.all([
      prisma.xpEntry.findMany({
        where: { companyId, employeeId: user.id, createdAt: { gte: startOfMonth } },
        orderBy: { createdAt: "desc" },
      }),
      getMonthlyScore(companyId, user.id, now),
      getServiceFeeAdjustment(companyId, user.id, now),
      getServiceFeeTiersSorted(companyId),
      prisma.internalProgram.findUnique({ where: { companyId }, select: { basePoints: true } }),
    ])

    // Próxima faixa que rende mais do que a atual (para "quantos pontos faltam para melhorar o ganho").
    const nextTier = allTiers
      .filter((t) => t.minPoints > monthlyScore)
      .sort((a, b) => a.minPoints - b.minPoints)[0]

    return Response.json({
      monthlyScore,
      basePoints: program?.basePoints ?? 100,
      entries,
      serviceFeeAdjustment,
      tiers: allTiers,
      nextTier: nextTier
        ? {
            minPoints: nextTier.minPoints,
            maxPoints: nextTier.maxPoints,
            percentage: nextTier.percentage ? Number(nextTier.percentage) : null,
            fixedAmount: nextTier.fixedAmount ? Number(nextTier.fixedAmount) : null,
            pointsMissing: nextTier.minPoints - monthlyScore,
          }
        : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
