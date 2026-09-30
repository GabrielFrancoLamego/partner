import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"

/**
 * Saldo disponível para saque, separado POR EMPRESA — cada empresa é uma
 * entidade financeira diferente (ver /partner/comissoes). Aproximação a
 * partir do livro-razão existente (Commission aprovada/paga menos Withdrawal
 * já solicitado/pago), já que PartnerProfile.walletBalance é um único total
 * global — a soma das linhas aqui bate com esse total na prática, mas o
 * saldo global continua sendo a fonte da verdade para o saque em si.
 */
export async function GET() {
  try {
    const user = await requirePartner()

    const [earnedByCompany, withdrawnByCompany, companies] = await Promise.all([
      prisma.commission.groupBy({
        by: ["companyId"],
        where: { partnerId: user.id, status: { in: ["APPROVED", "PAID"] } },
        _sum: { commissionValue: true },
      }),
      prisma.withdrawal.groupBy({
        by: ["companyId"],
        where: { partnerId: user.id, status: { in: ["PENDING", "APPROVED", "PAID"] } },
        _sum: { amount: true },
      }),
      prisma.commission.findMany({
        where: { partnerId: user.id },
        distinct: ["companyId"],
        select: { company: { select: { id: true, name: true } } },
      }),
    ])

    const earnedMap = new Map(earnedByCompany.map((e) => [e.companyId, Number(e._sum.commissionValue ?? 0)]))
    const withdrawnMap = new Map(withdrawnByCompany.map((w) => [w.companyId, Number(w._sum.amount ?? 0)]))

    const rows = companies.map(({ company }) => {
      const totalEarned = earnedMap.get(company.id) ?? 0
      const totalWithdrawn = withdrawnMap.get(company.id) ?? 0
      return {
        companyId: company.id,
        companyName: company.name,
        totalEarned,
        totalWithdrawn,
        availableBalance: Math.max(0, totalEarned - totalWithdrawn),
      }
    })

    return Response.json(rows.sort((a, b) => b.availableBalance - a.availableBalance))
  } catch (error) {
    return handleApiError(error)
  }
}
