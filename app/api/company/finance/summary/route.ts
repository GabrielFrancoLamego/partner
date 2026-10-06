import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { EARNING_OCCURRENCE_TYPES } from "@/lib/finance-settlement"

/**
 * Contadores do módulo Financeiro — alimentam o badge piscante do menu lateral
 * (total de pendências com vencimento HOJE ou já vencidas) e os números ao
 * lado do título de cada sub-aba. `pending` = tudo que aguarda ação;
 * `dueToday` = a parte com vencimento até o fim de hoje.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const companyId = user.companyId

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const dueByToday = { OR: [{ expectedPaymentDate: { lte: endOfToday } }, { expectedPaymentDate: null, date: { lte: endOfToday } }] }

    const employeeEarning = {
      companyId,
      employeeId: { not: null },
      total: { not: null },
      paymentStatus: "PENDING" as const,
      goalPayout: { is: null },
      OR: [{ type: { in: EARNING_OCCURRENCE_TYPES } }, { type: "CUSTOM" as const, customType: { salaryImpactType: "BONUS" as const } }],
    }

    const [approvedWithdrawals, externalPending, externalDue, requestedWithdrawals, commissionsToAct, receivablesPending, receivablesDue, payoutsPending, payoutsDue] =
      await Promise.all([
        prisma.withdrawal.count({ where: { companyId, status: "APPROVED" } }),
        prisma.occurrence.count({ where: { companyId, employeeId: null, total: { not: null }, paymentStatus: "PENDING" } }),
        prisma.occurrence.count({ where: { companyId, employeeId: null, total: { not: null }, paymentStatus: "PENDING", ...dueByToday } }),
        prisma.withdrawal.count({ where: { companyId, status: "PENDING" } }),
        prisma.commission.count({ where: { companyId, OR: [{ amount: null }, { status: { in: ["AWAITING_VALUE", "PENDING"] } }] } }),
        prisma.occurrence.count({ where: employeeEarning }),
        prisma.occurrence.count({ where: { AND: [employeeEarning, dueByToday] } }),
        prisma.goalPayout.count({ where: { companyId, status: "PENDING" } }),
        prisma.goalPayout.count({
          where: { companyId, status: "PENDING", OR: [{ expectedPaymentDate: { lte: endOfToday } }, { expectedPaymentDate: null, paidAt: { lte: endOfToday } }] },
        }),
      ])

    const payables = { pending: approvedWithdrawals + externalPending, dueToday: approvedWithdrawals + externalDue }
    const commissionsWithdrawals = { pending: requestedWithdrawals + commissionsToAct, dueToday: requestedWithdrawals + commissionsToAct }
    const receivables = { pending: receivablesPending + payoutsPending, dueToday: receivablesDue + payoutsDue }

    return Response.json({
      tabs: { payables, commissionsWithdrawals, receivables },
      dueTodayTotal: payables.dueToday + commissionsWithdrawals.dueToday + receivables.dueToday,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
