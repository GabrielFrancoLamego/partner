import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { periodStart, previousPeriodRange, growthRate } from "@/lib/period-range"
import { PLAN_IDS, monthlyRevenueFor, isPlanId } from "@/lib/plans"
import { getPlanCatalog } from "@/lib/plan-catalog"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId") ?? "all"
    const period = searchParams.get("period") ?? "month"

    const companyWhere = companyId !== "all" ? { companyId } : {}
    const start = periodStart(period)
    const dateWhere = (field: string) => (start ? { [field]: { gte: start } } : {})
    const prevRange = previousPeriodRange(period)

    const now = new Date()

    const [
      totalCompanies,
      companiesInPeriod,
      companiesInPrevPeriod,
      activeCampaigns,
      commissionAggregate,
      paidCommissionAggregate,
      totalReferrals,
      visitedReferrals,
      notVisitedReferrals,
      totalEmployees,
      xpAggregate,
      executedChecklistRows,
      totalUsers,
      activeUsersInPeriod,
      activeUsersInPrevPeriod,
      allLicenses,
      planCatalog,
    ] = await Promise.all([
      prisma.company.count({ where: companyId !== "all" ? { id: companyId } : {} }),
      prevRange ? prisma.company.count({ where: { createdAt: { gte: start! } } }) : Promise.resolve(0),
      prevRange
        ? prisma.company.count({ where: { createdAt: { gte: prevRange.start, lt: prevRange.end } } })
        : Promise.resolve(0),
      prisma.promotion.count({
        where: { ...companyWhere, active: true, validUntil: { gte: now } },
      }),
      prisma.commission.aggregate({
        where: { ...companyWhere, ...dateWhere("date") },
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        where: { ...companyWhere, ...dateWhere("date"), status: "PAID" },
        _sum: { commissionValue: true },
      }),
      prisma.referral.count({ where: { ...companyWhere, ...dateWhere("indicatedAt") } }),
      prisma.referral.count({ where: { ...companyWhere, ...dateWhere("indicatedAt"), visited: true } }),
      prisma.referral.count({
        where: { ...companyWhere, ...dateWhere("indicatedAt"), visited: false, status: "NOT_VISITED" },
      }),
      prisma.user.count({ where: { ...companyWhere, role: "EMPLOYEE" } }),
      prisma.employeeProfile.aggregate({
        where: companyId !== "all" ? { user: { companyId } } : {},
        _avg: { xpPoints: true },
      }),
      // Comparação dueAt vs approvedAt precisa ser feita em memória — o Prisma
      // não suporta comparar duas colunas da mesma linha em `where` sem SQL cru.
      prisma.checklist.findMany({
        where: { ...companyWhere, ...dateWhere("createdAt"), status: { in: ["APPROVED", "REJECTED"] } },
        select: { dueAt: true, approvedAt: true },
      }),
      // Engajamento: usuários que acessaram DENTRO do período do filtro (não um
      // recorte fixo de hoje/30 dias) sobre o total de usuários da plataforma.
      prisma.user.count({ where: companyWhere }),
      prisma.user.count({ where: { ...companyWhere, ...dateWhere("lastActiveAt") } }),
      prevRange
        ? prisma.user.count({ where: { ...companyWhere, lastActiveAt: { gte: prevRange.start, lt: prevRange.end } } })
        : Promise.resolve(0),
      prisma.license.findMany({ select: { plan: true, status: true, billingCycle: true, isExempt: true, expiresAt: true, canceledAt: true, createdAt: true } }),
      getPlanCatalog(),
    ])

    const totalBilled = Number(commissionAggregate._sum.amount ?? 0)
    const totalCommissionsPaid = Number(paidCommissionAggregate._sum.commissionValue ?? 0)
    const conversionRate = totalReferrals > 0 ? Math.round((visitedReferrals / totalReferrals) * 1000) / 10 : 0

    const executedChecklists = executedChecklistRows.length
    const onTimeChecklists = executedChecklistRows.filter(
      (c) => !c.dueAt || (c.approvedAt && c.approvedAt <= c.dueAt),
    ).length
    const complianceRate = executedChecklists > 0 ? Math.round((onTimeChecklists / executedChecklists) * 1000) / 10 : 0

    const engagementRate = totalUsers > 0 ? Math.round((activeUsersInPeriod / totalUsers) * 1000) / 10 : 0
    const prevEngagementRate = totalUsers > 0 ? (activeUsersInPrevPeriod / totalUsers) * 100 : 0
    const engagementTrend: "up" | "down" | null = prevRange ? (engagementRate >= prevEngagementRate ? "up" : "down") : null

    // Distribuição por Planos SaaS — sempre calculada sobre TODAS as empresas
    // (métrica de saúde da plataforma), independente do filtro de empresa da tela.
    const planDistribution = PLAN_IDS.map((planId) => {
      const licenses = allLicenses.filter((l) => (isPlanId(l.plan) ? l.plan : "ENTERPRISE") === planId)
      const activeLicenses = licenses.filter((l) => l.status === "ACTIVE")
      const overdue = licenses.filter(
        (l) => l.status === "SUSPENDED" || (l.status === "ACTIVE" && l.expiresAt !== null && l.expiresAt < now),
      )
      const churnedInPeriod = licenses.filter((l) => l.canceledAt && (!start || l.canceledAt >= start))
      const churnRate = licenses.length > 0 ? Math.round((churnedInPeriod.length / licenses.length) * 1000) / 10 : 0

      const monthlyRevenue = activeLicenses
        .filter((l) => !l.isExempt)
        .reduce((sum, l) => sum + monthlyRevenueFor(planCatalog, l.plan), 0)

      const avgRevenuePerCompany = activeLicenses.length > 0 ? monthlyRevenue / activeLicenses.length : 0
      const ltv = churnRate > 0 ? avgRevenuePerCompany / (churnRate / 100) : avgRevenuePerCompany * 24

      return {
        plan: planId,
        label: planCatalog[planId].label,
        companies: licenses.length,
        active: activeLicenses.length,
        overdue: overdue.length,
        churnCount: churnedInPeriod.length,
        churnRate,
        monthlyRevenue,
        ltv: Math.round(ltv * 100) / 100,
      }
    })

    let companyDetail: Record<string, unknown> | null = null
    if (companyId !== "all") {
      const [pendingWithdrawals, pendingCommissions, pendingShiftClosings, activeEmployees, license] =
        await Promise.all([
          prisma.withdrawal.count({ where: { companyId, status: "PENDING" } }),
          prisma.commission.count({ where: { companyId, status: { in: ["PENDING", "AWAITING_VALUE"] } } }),
          prisma.shiftClosing.count({ where: { companyId, status: { in: ["PENDING_GERENTE", "PENDING_MASTER"] } } }),
          prisma.user.count({ where: { companyId, role: "EMPLOYEE", status: "ACTIVE" } }),
          prisma.license.findUnique({ where: { companyId } }),
        ])

      const licenseExpiringSoon =
        !!license?.expiresAt && license.expiresAt.getTime() - now.getTime() < 15 * 24 * 60 * 60 * 1000

      companyDetail = {
        pendingWithdrawals,
        pendingCommissions,
        pendingShiftClosings,
        activeEmployees,
        licenseExpiringSoon,
      }
    }

    return Response.json({
      business: {
        totalCompanies,
        growthRate: growthRate(companiesInPeriod, companiesInPrevPeriod),
        activeCampaigns,
        totalBilled,
        totalCommissionsPaid,
      },
      referralFunnel: {
        totalReferrals,
        visited: visitedReferrals,
        notVisited: notVisitedReferrals,
        conversionRate,
      },
      operations: {
        totalEmployees,
        averageXp: Math.round(xpAggregate._avg.xpPoints ?? 0),
        executedChecklists,
        complianceRate,
      },
      usage: {
        activeUsers: activeUsersInPeriod,
        totalUsers,
        engagementRate,
        trend: engagementTrend,
      },
      planDistribution,
      companyDetail,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
