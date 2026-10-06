import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { EARNING_OCCURRENCE_TYPES } from "@/lib/finance-settlement"

/**
 * Carteiras (Admin da plataforma) — parceiros (saldo da carteira, comissões
 * aprovadas, saques pendentes/pagos) e colaboradores (a receber, já recebido e
 * Conta de Consumo), de uma empresa (?companyId=) ou de todo o grupo ("all").
 */
export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const companyParam = new URL(request.url).searchParams.get("companyId")
    const companyId = companyParam && companyParam !== "all" ? companyParam : null
    const scope = companyId ? { companyId } : {}

    const [withdrawalGroups, commissionGroups, occurrenceGroups, payoutGroups] = await Promise.all([
      prisma.withdrawal.groupBy({ by: ["partnerId", "status"], where: scope, _sum: { amount: true } }),
      prisma.commission.groupBy({ by: ["partnerId"], where: { ...scope, status: { in: ["APPROVED", "PAID"] } }, _sum: { commissionValue: true } }),
      prisma.occurrence.groupBy({
        by: ["employeeId", "paymentStatus"],
        where: { ...scope, employeeId: { not: null }, total: { not: null }, OR: [{ type: { in: EARNING_OCCURRENCE_TYPES } }, { type: "CUSTOM", customType: { salaryImpactType: "BONUS" } }] },
        _sum: { total: true },
      }),
      prisma.goalPayout.groupBy({ by: ["employeeId", "status"], where: scope, _sum: { amount: true } }),
    ])

    const partnerIds = Array.from(new Set([...withdrawalGroups.map((g) => g.partnerId), ...commissionGroups.map((g) => g.partnerId)]))
    const [partners, employees] = await Promise.all([
      prisma.user.findMany({
        where: companyId ? { id: { in: partnerIds }, role: "PARTNER" } : { role: "PARTNER" },
        select: { id: true, name: true, email: true, partnerProfile: { select: { walletBalance: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "EMPLOYEE", ...(companyId ? { companyId } : {}) },
        select: { id: true, name: true, consumptionDebt: true, company: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      }),
    ])

    const sumWithdrawals = (partnerId: string, status: string) =>
      withdrawalGroups.filter((g) => g.partnerId === partnerId && g.status === status).reduce((s, g) => s + Number(g._sum.amount ?? 0), 0)

    return Response.json({
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        walletBalance: Number(p.partnerProfile?.walletBalance ?? 0),
        commissionsApproved: Number(commissionGroups.find((g) => g.partnerId === p.id)?._sum.commissionValue ?? 0),
        withdrawalsPending: sumWithdrawals(p.id, "PENDING") + sumWithdrawals(p.id, "APPROVED"),
        withdrawalsPaid: sumWithdrawals(p.id, "PAID"),
      })),
      employees: employees.map((e) => {
        const occ = (status: string) => occurrenceGroups.filter((g) => g.employeeId === e.id && g.paymentStatus === status).reduce((s, g) => s + Math.abs(Number(g._sum.total ?? 0)), 0)
        const payout = (status: string) => payoutGroups.filter((g) => g.employeeId === e.id && g.status === status).reduce((s, g) => s + Number(g._sum.amount ?? 0), 0)
        return {
          id: e.id,
          name: e.name,
          company: e.company,
          pending: occ("PENDING") + payout("PENDING"),
          paid: occ("PAID") + payout("PAID"),
          consumptionDebt: Number(e.consumptionDebt),
        }
      }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
