import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { monthlyRevenueFor } from "@/lib/plans"
import { getPlanCatalog } from "@/lib/plan-catalog"

/**
 * Saúde financeira do SaaS: planos pagos no mês corrente, inadimplência,
 * churn (últimos 30 dias) e projeção de recebíveis dos próximos 6 meses —
 * projeção simples de MRR decaindo pela taxa de churn mensal corrente
 * (mrr * (1 - churnRate)^n), método padrão quando não há histórico
 * suficiente para uma curva de coorte real.
 */
export async function GET() {
  try {
    await requirePlatformAdmin()
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [licenses, catalog] = await Promise.all([
      prisma.license.findMany({
        select: { plan: true, status: true, billingCycle: true, isExempt: true, expiresAt: true, canceledAt: true, createdAt: true },
      }),
      getPlanCatalog(),
    ])

    const activeNonExempt = licenses.filter((l) => l.status === "ACTIVE" && !l.isExempt)
    const paidThisMonth = activeNonExempt.filter((l) => l.createdAt < now) // toda licença ativa gera cobrança no mês corrente
    const mrr = paidThisMonth.reduce((sum, l) => sum + monthlyRevenueFor(catalog, l.plan), 0)

    const overdue = licenses.filter(
      (l) => l.status === "SUSPENDED" || (l.status === "ACTIVE" && l.expiresAt !== null && l.expiresAt < now),
    )
    const overdueValue = overdue.reduce((sum, l) => sum + monthlyRevenueFor(catalog, l.plan), 0)

    const churnedThisMonth = licenses.filter((l) => l.canceledAt && l.canceledAt >= startOfMonth)
    const churnedLast30d = licenses.filter((l) => l.canceledAt && l.canceledAt >= thirtyDaysAgo)
    const baseForChurn = activeNonExempt.length + churnedLast30d.length
    const churnRate = baseForChurn > 0 ? churnedLast30d.length / baseForChurn : 0

    const projection = Array.from({ length: 6 }, (_, i) => {
      const monthsAhead = i + 1
      const projectedMrr = mrr * Math.pow(1 - churnRate, monthsAhead)
      const date = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1)
      return { month: date.toISOString().slice(0, 7), projectedMrr: Math.round(projectedMrr * 100) / 100 }
    })

    return Response.json({
      mrr,
      paidLicensesCount: paidThisMonth.length,
      overdueCount: overdue.length,
      overdueValue,
      churnedThisMonthCount: churnedThisMonth.length,
      churnRatePercent: Math.round(churnRate * 1000) / 10,
      projection,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
