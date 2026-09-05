import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { periodStart } from "@/lib/period-range"
import { resolveCareerProgress, getMonthlyScore, computeDailyEfficiency, type EfficiencyMedal } from "@/lib/gamification"

/** Tipos de ocorrência com impacto financeiro somado no "Custo Operacional" do Master (vales, diárias, quebra de caixa, metas batidas). */
const COST_OCCURRENCE_TYPES = ["VALE", "DIARIA", "CONSUMO", "META"] as const

/**
 * Dashboard unificado de /company/dashboard. Métricas de Parceiros +
 * Operação/RH sempre presentes (Master/Gerente/Financeiro/Colaborador podem
 * ver o panorama da própria empresa); o bloco `me` (Modo Game) só é
 * preenchido quando quem pede é EMPLOYEE — Master/Gerente/Financeiro não têm
 * EmployeeProfile.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") ?? "month"
    const start = periodStart(period)
    const dateWhere = (field: string) => (start ? { [field]: { gte: start } } : {})

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      activePartnerIds,
      pendingCommissions,
      pendingWithdrawals,
      topPartnersRaw,
      totalEmployees,
      presentTodayIds,
      checklistRows,
      occurrencesThisMonth,
      company,
    ] = await Promise.all([
      prisma.commission.findMany({
        where: { companyId, ...dateWhere("date"), partner: { status: "ACTIVE" } },
        select: { partnerId: true },
        distinct: ["partnerId"],
      }),
      prisma.commission.aggregate({
        where: { companyId, status: "PENDING" },
        _sum: { commissionValue: true },
        _count: true,
      }),
      prisma.withdrawal.aggregate({
        where: { companyId, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.commission.groupBy({
        by: ["partnerId"],
        where: { companyId, status: { in: ["APPROVED", "PAID"] }, ...dateWhere("date") },
        _sum: { commissionValue: true },
        orderBy: { _sum: { commissionValue: "desc" } },
        take: 5,
      }),
      prisma.user.count({ where: { companyId, role: "EMPLOYEE" } }),
      prisma.timeEntry.findMany({
        where: { companyId, type: "CHECK_IN", createdAt: { gte: startOfToday } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.checklist.findMany({
        where: { companyId, createdAt: { gte: startOfMonth } },
        select: { status: true, dueAt: true, approvedAt: true },
      }),
      prisma.occurrence.count({ where: { companyId, date: { gte: startOfMonth } } }),
      prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } }),
    ])

    const topPartners = await Promise.all(
      topPartnersRaw.map(async (row) => {
        const partner = await prisma.user.findUnique({ where: { id: row.partnerId }, select: { id: true, name: true } })
        return { partnerId: row.partnerId, name: partner?.name ?? "—", total: Number(row._sum.commissionValue ?? 0) }
      }),
    )

    const executedChecklists = checklistRows.filter((c) => c.status !== "PENDING").length
    const onTimeChecklists = checklistRows.filter(
      (c) => c.status === "APPROVED" && (!c.dueAt || (c.approvedAt && c.approvedAt <= c.dueAt)),
    ).length
    const lateOrFailedChecklists = executedChecklists - onTimeChecklists
    const pendingChecklists = checklistRows.filter((c) => c.status === "PENDING").length

    let me: {
      xpPoints: number
      todayXp: number
      monthlyScore: number
      dailyEfficiencyPercent: number
      medal: EfficiencyMedal
      rank: number
      totalRanked: number
      currentLevel: ReturnType<typeof resolveCareerProgress>["currentLevel"]
      nextLevel: ReturnType<typeof resolveCareerProgress>["nextLevel"]
      progressToNextPercent: number
    } | null = null

    if (user.role === "EMPLOYEE") {
      const [profile, levels, todayXpAgg, ranked, monthlyScore, efficiency] = await Promise.all([
        prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { xpPoints: true } }),
        prisma.careerLevel.findMany({
          where: { companyId },
          select: { id: true, name: true, order: true, requiredXp: true, badgeColorHex: true },
        }),
        prisma.xpEntry.aggregate({
          where: { companyId, employeeId: user.id, createdAt: { gte: startOfToday } },
          _sum: { points: true },
        }),
        prisma.employeeProfile.findMany({
          where: { user: { companyId, role: "EMPLOYEE" } },
          select: { userId: true, xpPoints: true },
          orderBy: { xpPoints: "desc" },
        }),
        getMonthlyScore(companyId, user.id, now),
        computeDailyEfficiency(companyId, user.id, now),
      ])

      const xpPoints = profile?.xpPoints ?? 0
      const progress = resolveCareerProgress(xpPoints, levels)
      const rank = ranked.findIndex((r) => r.userId === user.id) + 1

      me = {
        xpPoints,
        todayXp: todayXpAgg._sum.points ?? 0,
        monthlyScore,
        dailyEfficiencyPercent: efficiency.efficiencyPercent,
        medal: efficiency.medal,
        rank: rank || ranked.length + 1,
        totalRanked: ranked.length,
        currentLevel: progress.currentLevel,
        nextLevel: progress.nextLevel,
        progressToNextPercent: progress.progressToNextPercent,
      }
    }

    let master: {
      shiftClosingToday: {
        status: string
        overdue: boolean
        revenueAmount: number | null
        receiptUrl: string | null
        isMasterOverride: boolean
        closedByName: string | null
      } | null
      realRevenue: number
      occurrenceCost: number
      riskEmployees: { id: string; name: string; monthlyScore: number; recentFlags: number }[]
    } | null = null

    if (canManageDailyOperations(user.role)) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const [companyDeadline, todayClosing, revenueAgg, occurrenceCostRows, employeesForRisk] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true } }),
        prisma.shiftClosing.findUnique({
          where: { companyId_date: { companyId, date: startOfToday } },
          include: { closedBy: { select: { name: true } } },
        }),
        prisma.shiftClosing.aggregate({ where: { companyId, ...dateWhere("date") }, _sum: { revenueAmount: true } }),
        prisma.occurrence.findMany({
          where: { companyId, type: { in: [...COST_OCCURRENCE_TYPES] }, ...dateWhere("date") },
          select: { total: true, discountWaived: true },
        }),
        prisma.user.findMany({
          where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
          select: { id: true, name: true },
        }),
      ])

      const [h, m] = companyDeadline.shiftClosingDeadline.split(":").map(Number)
      const cutoff = new Date(startOfToday)
      cutoff.setHours(h, m, 0, 0)
      const overdue = (!todayClosing || todayClosing.status !== "COMPLETED") && now > cutoff

      const occurrenceCost = occurrenceCostRows
        .filter((o) => !o.discountWaived)
        .reduce((sum, o) => sum + Math.abs(Number(o.total ?? 0)), 0)

      const riskEmployees = (
        await Promise.all(
          employeesForRisk.map(async (e) => {
            const [score, recentFlags] = await Promise.all([
              getMonthlyScore(companyId, e.id, now),
              prisma.occurrence.count({
                where: { companyId, employeeId: e.id, type: { in: ["ADVERTENCIA", "FALTA"] }, date: { gte: thirtyDaysAgo } },
              }),
            ])
            return { id: e.id, name: e.name, monthlyScore: score, recentFlags }
          }),
        )
      ).filter((e) => e.monthlyScore < 50 || e.recentFlags >= 2)

      master = {
        shiftClosingToday: todayClosing
          ? {
              status: todayClosing.status,
              overdue,
              revenueAmount: todayClosing.revenueAmount ? Number(todayClosing.revenueAmount) : null,
              receiptUrl: todayClosing.receiptUrl,
              isMasterOverride: todayClosing.isMasterOverride,
              closedByName: todayClosing.closedBy?.name ?? null,
            }
          : { status: "PENDING_GERENTE", overdue, revenueAmount: null, receiptUrl: null, isMasterOverride: false, closedByName: null },
        realRevenue: Number(revenueAgg._sum.revenueAmount ?? 0),
        occurrenceCost,
        riskEmployees,
      }
    }

    return Response.json({
      companyName: company.name,
      partners: {
        activePartners: activePartnerIds.length,
        pendingCommissions: { total: Number(pendingCommissions._sum.commissionValue ?? 0), count: pendingCommissions._count },
        pendingWithdrawals: { total: Number(pendingWithdrawals._sum.amount ?? 0), count: pendingWithdrawals._count },
        topPartners,
      },
      operations: {
        totalEmployees,
        presentToday: presentTodayIds.length,
        attendanceRate: totalEmployees > 0 ? Math.round((presentTodayIds.length / totalEmployees) * 1000) / 10 : 0,
        executedChecklists,
        onTimeChecklists,
        lateOrFailedChecklists,
        pendingChecklists,
        occurrencesThisMonth,
      },
      me,
      master,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
