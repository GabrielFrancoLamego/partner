import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { periodStart } from "@/lib/period-range"
import { resolveCareerProgress, getMonthlyScore, computeDailyEfficiency, type EfficiencyMedal } from "@/lib/gamification"
import { computePendingTimeclockAdjustments } from "@/lib/timeclock-adjustments"

/** Tipos de ocorrência com impacto financeiro somado no "Custo Operacional" do Master (vales, diárias, horas extras, metas batidas). */
const COST_OCCURRENCE_TYPES = ["VALE", "DIARIA", "HORA_EXTRA", "META"] as const

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((r) => [r.id, r])).values())
}

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
        _sum: { commissionValue: true, amount: true },
        // `_count.promotionId` conta só os registros com promotionId preenchido —
        // ou seja, indicações atreladas a um Vale Retorno/promoção específica.
        _count: { _all: true, promotionId: true },
        // Ranking pelo que o parceiro gerou pra empresa (faturamento), não pelo
        // valor pago a ele — esse card não mostra mais a comissão paga.
        orderBy: { _sum: { amount: "desc" } },
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
        return {
          partnerId: row.partnerId,
          name: partner?.name ?? "—",
          revenueGenerated: Number(row._sum.amount ?? 0),
          referralCount: row._count._all,
          vouchersUsed: row._count.promotionId,
        }
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
      const [profile, program, todayXpAgg, ranked, monthlyScore, efficiency] = await Promise.all([
        prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { xpPoints: true, currentInternalLevelId: true } }),
        prisma.internalProgram.findUnique({ where: { companyId }, select: { levels: { orderBy: { order: "asc" } } } }),
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
      const progress = resolveCareerProgress(xpPoints, program?.levels ?? [], profile?.currentInternalLevelId ?? null)
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
      costBreakdown: { salarios: number; diarias: number; horasExtras: number; consumo: number; outrasOcorrencias: number }
      riskEmployees: { id: string; name: string; monthlyScore: number; recentFlags: number }[]
      topEmployees: { id: string; name: string; points: number; efficiencyPercent: number | null }[]
      unclosedPastDaysCount: number
      panoramaToday: {
        presentes: { count: number; employees: { id: string; name: string }[] }
        faltas: { count: number; employees: { id: string; name: string }[] }
        folgas: { count: number; employees: { id: string; name: string }[] }
        atrasos: { count: number; employees: { id: string; name: string }[] }
        checklistsAtrasados: { count: number; employees: { id: string; name: string }[] }
      }
    } | null = null

    if (canManageDailyOperations(user.role)) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const fourteenDaysAgo = new Date(startOfToday.getTime() - 14 * 24 * 60 * 60 * 1000)
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
      const todayWeekday = startOfToday.getDay()

      const [
        companyRow,
        todayClosing,
        revenueAgg,
        occurrenceCostRows,
        consumoAgg,
        salariesAgg,
        employeesForRisk,
        completedPastClosings,
        presentTodayUsers,
        faltaToday,
        pendingAdjustmentsToday,
        lateChecklistsToday,
      ] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true, createdAt: true } }),
        prisma.shiftClosing.findUnique({
          where: { companyId_date: { companyId, date: startOfToday } },
          include: { closedBy: { select: { name: true } } },
        }),
        prisma.shiftClosing.aggregate({ where: { companyId, ...dateWhere("date") }, _sum: { revenueAmount: true } }),
        prisma.occurrence.findMany({
          where: { companyId, type: { in: [...COST_OCCURRENCE_TYPES] }, ...dateWhere("date") },
          select: { type: true, total: true, discountWaived: true },
        }),
        prisma.occurrence.aggregate({
          where: { companyId, type: "CONSUMO", ...dateWhere("date") },
          _sum: { total: true },
        }),
        prisma.employeeProfile.aggregate({
          where: { user: { companyId, role: "EMPLOYEE", status: "ACTIVE" } },
          _sum: { monthlySalary: true },
        }),
        prisma.user.findMany({
          where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
          select: { id: true, name: true, employeeProfile: { select: { xpPoints: true, weeklyDayOff: true } } },
        }),
        prisma.shiftClosing.findMany({
          where: { companyId, date: { gte: fourteenDaysAgo, lt: startOfToday }, status: "COMPLETED" },
          select: { date: true },
        }),
        prisma.timeEntry.findMany({
          where: { companyId, type: "CHECK_IN", createdAt: { gte: startOfToday } },
          select: { userId: true, user: { select: { id: true, name: true } } },
          distinct: ["userId"],
        }),
        prisma.occurrence.findMany({
          where: { companyId, type: "FALTA", date: { gte: startOfToday, lt: endOfToday }, employeeId: { not: null } },
          select: { employee: { select: { id: true, name: true } } },
        }),
        computePendingTimeclockAdjustments(companyId, startOfToday),
        prisma.checklist.findMany({
          where: { companyId, forDate: startOfToday, status: "PENDING", dueAt: { lt: now } },
          select: { employee: { select: { id: true, name: true } } },
        }),
      ])
      const companyDeadline = companyRow

      const [h, m] = companyDeadline.shiftClosingDeadline.split(":").map(Number)
      const cutoff = new Date(startOfToday)
      cutoff.setHours(h, m, 0, 0)
      const overdue = (!todayClosing || todayClosing.status !== "COMPLETED") && now > cutoff

      // "Não bloqueia": mesmo com o dia seguinte já rolando normalmente, o caixa
      // de dias anteriores sem fechamento continua sinalizado até regularizar.
      const searchStart = new Date(Math.max(fourteenDaysAgo.getTime(), startOfDay(companyRow.createdAt).getTime()))
      const completedDates = new Set(completedPastClosings.map((c) => c.date.toISOString()))
      let unclosedPastDaysCount = 0
      for (let d = new Date(searchStart); d < startOfToday; d.setDate(d.getDate() + 1)) {
        if (!completedDates.has(startOfDay(d).toISOString())) unclosedPastDaysCount++
      }

      const liveRows = occurrenceCostRows.filter((o) => !o.discountWaived)
      const sumByType = (type: (typeof COST_OCCURRENCE_TYPES)[number]) =>
        liveRows.filter((o) => o.type === type).reduce((sum, o) => sum + Math.abs(Number(o.total ?? 0)), 0)
      // Fração proporcional da folha fixa no período selecionado — período "all"
      // (sem limite) usa 1 mês cheio como referência, em vez de somar anos de
      // folha e distorcer o Custo Operacional.
      const periodDays = start ? Math.max(1, (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) : 30
      const salarios = Number(salariesAgg._sum.monthlySalary ?? 0) * (periodDays / 30)
      const costBreakdown = {
        salarios,
        diarias: sumByType("DIARIA"),
        horasExtras: sumByType("HORA_EXTRA"),
        consumo: Math.abs(Number(consumoAgg._sum.total ?? 0)),
        outrasOcorrencias: sumByType("VALE") + sumByType("META"),
      }
      // Custo Operacional completo: folha proporcional + consumo lançado +
      // demais ocorrências financeiras do período (pedido explícito do Master).
      const occurrenceCost = costBreakdown.salarios + costBreakdown.consumo + costBreakdown.diarias + costBreakdown.horasExtras + costBreakdown.outrasOcorrencias

      const scoredEmployees = await Promise.all(
        employeesForRisk.map(async (e) => {
          const [score, recentFlags, periodXpAgg, periodChecklists] = await Promise.all([
            getMonthlyScore(companyId, e.id, now),
            prisma.occurrence.count({
              where: { companyId, employeeId: e.id, type: { in: ["ADVERTENCIA", "FALTA"] }, date: { gte: thirtyDaysAgo } },
            }),
            prisma.xpEntry.aggregate({ where: { companyId, employeeId: e.id, ...dateWhere("createdAt") }, _sum: { points: true } }),
            prisma.checklist.findMany({ where: { companyId, employeeId: e.id, ...dateWhere("createdAt") }, select: { status: true } }),
          ])
          const checklistTotal = periodChecklists.length
          const checklistApproved = periodChecklists.filter((c) => c.status === "APPROVED").length
          return {
            id: e.id,
            name: e.name,
            monthlyScore: score,
            recentFlags,
            xpPoints: e.employeeProfile?.xpPoints ?? 0,
            periodPoints: periodXpAgg._sum.points ?? 0,
            efficiencyPercent: checklistTotal > 0 ? Math.round((checklistApproved / checklistTotal) * 100) : null,
            weeklyDayOff: e.employeeProfile?.weeklyDayOff ?? null,
          }
        }),
      )
      const riskEmployees = scoredEmployees.filter((e) => e.monthlyScore < 50 || e.recentFlags >= 2)
      // Ranking principal por Pontuação acumulada no período selecionado (não pelo score mensal fixo).
      const topEmployees = [...scoredEmployees]
        .sort((a, b) => b.periodPoints - a.periodPoints)
        .slice(0, 5)
        .map((e) => ({ id: e.id, name: e.name, points: e.periodPoints, efficiencyPercent: e.efficiencyPercent }))

      const presentes = presentTodayUsers.map((t) => t.user)
      const faltas = dedupeById(faltaToday.map((o) => o.employee!).filter(Boolean))
      const folgas = scoredEmployees.filter((e) => e.weeklyDayOff === todayWeekday).map((e) => ({ id: e.id, name: e.name }))
      const atrasos = pendingAdjustmentsToday
        .filter((a) => a.kind === "LATE_CHECKIN" && a.isNegativeForEmployee)
        .map((a) => ({ id: a.employeeId, name: a.employeeName }))
      const checklistsAtrasados = dedupeById(lateChecklistsToday.map((c) => c.employee).filter(Boolean) as { id: string; name: string }[])

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
        costBreakdown,
        riskEmployees,
        topEmployees,
        unclosedPastDaysCount,
        panoramaToday: {
          presentes: { count: presentes.length, employees: presentes },
          faltas: { count: faltas.length, employees: faltas },
          folgas: { count: folgas.length, employees: folgas },
          atrasos: { count: atrasos.length, employees: atrasos },
          checklistsAtrasados: { count: checklistsAtrasados.length, employees: checklistsAtrasados },
        },
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
