import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { periodStart, previousPeriodRange, growthRate } from "@/lib/period-range"

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
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

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
      dau,
      mau,
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
      prisma.user.count({ where: { ...companyWhere, lastActiveAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { ...companyWhere, lastActiveAt: { gte: thirtyDaysAgo } } }),
    ])

    const totalBilled = Number(commissionAggregate._sum.amount ?? 0)
    const totalCommissionsPaid = Number(paidCommissionAggregate._sum.commissionValue ?? 0)
    const conversionRate = totalReferrals > 0 ? Math.round((visitedReferrals / totalReferrals) * 1000) / 10 : 0

    const executedChecklists = executedChecklistRows.length
    const onTimeChecklists = executedChecklistRows.filter(
      (c) => !c.dueAt || (c.approvedAt && c.approvedAt <= c.dueAt),
    ).length
    const complianceRate = executedChecklists > 0 ? Math.round((onTimeChecklists / executedChecklists) * 1000) / 10 : 0

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
      usage: { dau, mau },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
