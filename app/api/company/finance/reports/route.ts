import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canAccessFinanceModule } from "@/lib/permissions"
import { periodStart } from "@/lib/period-range"

/**
 * Relatórios Financeiros (/company/financeiro/relatorios) — 3 modos via
 * ?type=: withdrawals (saques realizados vs pendentes), wallets (carteiras
 * de parceiros e colaboradores) e roi (faturamento gerado via Scanner PDV vs
 * custo com comissões de parceiros).
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    if (!canManageDailyOperations(user.role) && !canAccessFinanceModule(user)) throw new ApiError(403, "Sem permissão para esta ação")
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") ?? "withdrawals"
    const period = searchParams.get("period") ?? "month"
    const start = periodStart(period)
    const dateWhere = start ? { gte: start } : undefined

    if (type === "withdrawals") {
      const [paid, pending, rejected, approved] = await Promise.all([
        prisma.withdrawal.aggregate({ where: { companyId, status: "PAID", ...(dateWhere ? { paidAt: dateWhere } : {}) }, _sum: { amount: true }, _count: true }),
        prisma.withdrawal.aggregate({ where: { companyId, status: "PENDING", ...(dateWhere ? { requestDate: dateWhere } : {}) }, _sum: { amount: true }, _count: true }),
        prisma.withdrawal.aggregate({ where: { companyId, status: "REJECTED", ...(dateWhere ? { requestDate: dateWhere } : {}) }, _sum: { amount: true }, _count: true }),
        prisma.withdrawal.aggregate({ where: { companyId, status: "APPROVED", ...(dateWhere ? { requestDate: dateWhere } : {}) }, _sum: { amount: true }, _count: true }),
      ])
      return Response.json({
        paid: { total: Number(paid._sum.amount ?? 0), count: paid._count },
        pending: { total: Number(pending._sum.amount ?? 0), count: pending._count },
        approved: { total: Number(approved._sum.amount ?? 0), count: approved._count },
        rejected: { total: Number(rejected._sum.amount ?? 0), count: rejected._count },
      })
    }

    if (type === "wallets") {
      const [partners, employeeOccurrences, employeeGoalPayouts, employees] = await Promise.all([
        prisma.user.findMany({
          where: { companyId: null, role: "PARTNER", commissionsAsPartner: { some: { companyId } } },
          select: { id: true, name: true, partnerProfile: { select: { walletBalance: true } } },
        }),
        prisma.occurrence.groupBy({
          by: ["employeeId", "paymentStatus"],
          where: { companyId, employeeId: { not: null }, total: { not: null } },
          _sum: { total: true },
        }),
        prisma.goalPayout.groupBy({ by: ["employeeId", "status"], where: { companyId }, _sum: { amount: true } }),
        prisma.user.findMany({ where: { companyId, role: "EMPLOYEE" }, select: { id: true, name: true } }),
      ])

      const partnerWallets = await Promise.all(
        partners.map(async (p) => {
          const pendingAgg = await prisma.withdrawal.aggregate({ where: { companyId, partnerId: p.id, status: "PENDING" }, _sum: { amount: true } })
          return {
            id: p.id,
            name: p.name,
            accumulated: Number(p.partnerProfile?.walletBalance ?? 0),
            pendingWithdrawals: Number(pendingAgg._sum.amount ?? 0),
          }
        }),
      )

      const employeeWallets = employees.map((e) => {
        const occPending = employeeOccurrences.filter((o) => o.employeeId === e.id && o.paymentStatus === "PENDING").reduce((s, o) => s + Number(o._sum.total ?? 0), 0)
        const occPaid = employeeOccurrences.filter((o) => o.employeeId === e.id && o.paymentStatus === "PAID").reduce((s, o) => s + Number(o._sum.total ?? 0), 0)
        const payoutPending = employeeGoalPayouts.filter((p) => p.employeeId === e.id && p.status === "PENDING").reduce((s, p) => s + Number(p._sum.amount ?? 0), 0)
        const payoutPaid = employeeGoalPayouts.filter((p) => p.employeeId === e.id && p.status === "PAID").reduce((s, p) => s + Number(p._sum.amount ?? 0), 0)
        return { id: e.id, name: e.name, pending: occPending + payoutPending, accumulated: occPaid + payoutPaid }
      })

      return Response.json({ partners: partnerWallets, employees: employeeWallets })
    }

    if (type === "roi") {
      const commissions = await prisma.commission.findMany({
        where: { companyId, status: { in: ["APPROVED", "PAID"] }, ...(dateWhere ? { date: dateWhere } : {}) },
        select: { partnerId: true, amount: true, commissionValue: true, partner: { select: { name: true } } },
      })
      const totalRevenueGenerated = commissions.reduce((s, c) => s + Number(c.amount ?? 0), 0)
      const totalCommissionCost = commissions.reduce((s, c) => s + Number(c.commissionValue ?? 0), 0)

      const byPartnerMap = new Map<string, { partnerId: string; name: string; revenueGenerated: number; commissionCost: number }>()
      for (const c of commissions) {
        const existing = byPartnerMap.get(c.partnerId)
        if (existing) {
          existing.revenueGenerated += Number(c.amount ?? 0)
          existing.commissionCost += Number(c.commissionValue ?? 0)
        } else {
          byPartnerMap.set(c.partnerId, {
            partnerId: c.partnerId,
            name: c.partner.name,
            revenueGenerated: Number(c.amount ?? 0),
            commissionCost: Number(c.commissionValue ?? 0),
          })
        }
      }

      return Response.json({
        totalRevenueGenerated,
        totalCommissionCost,
        netProfit: totalRevenueGenerated - totalCommissionCost,
        roiPercent: totalCommissionCost > 0 ? Math.round(((totalRevenueGenerated - totalCommissionCost) / totalCommissionCost) * 1000) / 10 : null,
        byPartner: Array.from(byPartnerMap.values()).sort((a, b) => b.revenueGenerated - a.revenueGenerated),
      })
    }

    throw new ApiError(400, "Tipo de relatório inválido")
  } catch (error) {
    return handleApiError(error)
  }
}
