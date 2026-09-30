import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"

/**
 * Recebíveis e Carteira dos Colaboradores — mapeia por colaborador os bônus
 * de meta (GoalPayout), ocorrências com valor monetário (VALE/META/HORA_EXTRA/
 * etc, ver Occurrence.total+paymentStatus) e premiações resgatadas na Loja de
 * Prêmios (RewardRedemption), separando o que já foi pago do que segue
 * pendente de quitação (ver POST /api/company/finance/goal-payouts).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const companyId = user.companyId

    const employees = await prisma.user.findMany({
      where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    const [occurrences, goalPayouts, redemptions] = await Promise.all([
      prisma.occurrence.findMany({
        where: { companyId, employeeId: { not: null }, total: { not: null } },
        select: { employeeId: true, type: true, total: true, paymentStatus: true, date: true, description: true },
        orderBy: { date: "desc" },
      }),
      prisma.goalPayout.findMany({
        where: { companyId },
        select: { employeeId: true, amount: true, status: true, rewardType: true, period: true, paidAt: true, note: true, goal: { select: { name: true } } },
        orderBy: { paidAt: "desc" },
      }),
      prisma.rewardRedemption.findMany({
        where: { companyId, status: { in: ["APPROVED", "DELIVERED"] } },
        select: { employeeId: true, costXp: true, status: true, createdAt: true, item: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const rows = employees.map((e) => {
      const empOccurrences = occurrences.filter((o) => o.employeeId === e.id)
      const empPayouts = goalPayouts.filter((p) => p.employeeId === e.id)
      const empRedemptions = redemptions.filter((r) => r.employeeId === e.id)

      const occurrencesPending = empOccurrences.filter((o) => o.paymentStatus === "PENDING")
      const occurrencesPaid = empOccurrences.filter((o) => o.paymentStatus === "PAID")
      const payoutsPending = empPayouts.filter((p) => p.status === "PENDING")
      const payoutsPaid = empPayouts.filter((p) => p.status === "PAID")

      const pendingAmount =
        occurrencesPending.reduce((sum, o) => sum + Number(o.total ?? 0), 0) + payoutsPending.reduce((sum, p) => sum + Number(p.amount), 0)
      const paidAmount = occurrencesPaid.reduce((sum, o) => sum + Number(o.total ?? 0), 0) + payoutsPaid.reduce((sum, p) => sum + Number(p.amount), 0)

      return {
        employeeId: e.id,
        employeeName: e.name,
        pendingAmount,
        paidAmount,
        occurrences: empOccurrences.map((o) => ({ type: o.type, total: Number(o.total ?? 0), status: o.paymentStatus, date: o.date, description: o.description })),
        goalPayouts: empPayouts.map((p) => ({
          goalName: p.goal.name,
          amount: Number(p.amount),
          status: p.status,
          rewardType: p.rewardType,
          period: p.period,
          paidAt: p.paidAt,
          note: p.note,
        })),
        redemptions: empRedemptions.map((r) => ({ itemName: r.item.name, costXp: r.costXp, status: r.status, createdAt: r.createdAt })),
      }
    })

    return Response.json(rows)
  } catch (error) {
    return handleApiError(error)
  }
}
