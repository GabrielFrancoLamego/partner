import "server-only"
import { prisma } from "./prisma"
import { BANKING_SELECT, occurrenceLabel, toRecipientBanking, type RecipientBanking } from "./finance-settlement"
import { computeEmployeeFinance, countReceivablesDueToday, endOfToday, parseMonth, type EmployeeFinance } from "./finance-employee"

export type PayableRow = {
  id: string
  kind: "WITHDRAWAL" | "OCCURRENCE"
  recipientType: "PARTNER" | "EXTERNAL"
  recipientId: string | null
  label: string
  amount: number
  dueDate: Date
  banking: RecipientBanking
}

/**
 * Contas a Pagar — compromissos com terceiros em ordem cronológica de
 * vencimento: Saques PIX de parceiros JÁ APROVADOS (vencimento = Data/Hora
 * Prevista de Pagamento) e ocorrências financeiras de favorecidos sem cadastro
 * (ex: diarista com nome livre). Pagamentos a colaboradores cadastrados NÃO
 * entram aqui — ficam em Recebíveis.
 */
export async function listPayables(companyId: string): Promise<PayableRow[]> {
  const [withdrawals, occurrences] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { companyId, status: "APPROVED" },
      include: { partner: { select: { id: true, name: true, partnerProfile: { select: { ...BANKING_SELECT, document: true } } } } },
    }),
    prisma.occurrence.findMany({
      where: { companyId, employeeId: null, total: { not: null }, paymentStatus: "PENDING" },
      include: { customType: { select: { name: true } } },
    }),
  ])

  return [
    ...withdrawals.map((w) => ({
      id: w.id,
      kind: "WITHDRAWAL" as const,
      recipientType: "PARTNER" as const,
      recipientId: w.partnerId,
      label: "Saque PIX de parceiro",
      amount: Number(w.amount),
      dueDate: w.expectedPaymentDate ?? w.approvedAt ?? w.requestDate,
      banking: { ...toRecipientBanking(w.partner.name, w.partner.partnerProfile), pixKey: w.pixKey ?? w.partner.partnerProfile?.pixKey ?? null },
    })),
    ...occurrences.map((o) => ({
      id: o.id,
      kind: "OCCURRENCE" as const,
      recipientType: "EXTERNAL" as const,
      recipientId: null,
      label: occurrenceLabel(o),
      amount: Math.abs(Number(o.total)),
      dueDate: o.expectedPaymentDate ?? o.date,
      banking: { ...toRecipientBanking(o.employeeNameFreeText ?? "Favorecido sem cadastro", null), fullName: o.employeeNameFreeText ?? "Favorecido sem cadastro" },
    })),
  ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

/** Registro de Quitação — extrato do mais recente ao mais antigo, filtrado estritamente pelo período (data do pagamento). */
export async function listSettlements(companyId: string, from: string | null, to: string | null) {
  const paidAt = {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  }
  const settlements = await prisma.financialSettlement.findMany({
    where: { companyId, ...(from || to ? { paidAt } : {}) },
    include: { paidBy: { select: { id: true, name: true } } },
    orderBy: { paidAt: "desc" },
    take: 1000,
  })
  return settlements.map((s) => ({ ...s, amount: Number(s.amount) }))
}

export async function listReceivables(companyId: string, monthParam: string | null): Promise<{ month: string; rows: EmployeeFinance[] }> {
  const month = parseMonth(monthParam).key
  const employees = await prisma.user.findMany({
    where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
    select: { id: true },
    orderBy: { name: "asc" },
  })
  const rows = await Promise.all(employees.map((e) => computeEmployeeFinance(companyId, e.id, month, { ensurePayroll: true })))
  return { month, rows: rows.filter((r): r is EmployeeFinance => r !== null) }
}

/** Saques (todas as situações, mais recentes primeiro) com os dados cadastrais do parceiro. */
export function listWithdrawals(companyId: string) {
  return prisma.withdrawal.findMany({
    where: { companyId },
    include: { partner: { select: { id: true, name: true, email: true, partnerProfile: { select: { ...BANKING_SELECT, document: true } } } } },
    orderBy: { requestDate: "desc" },
    take: 200,
  })
}

/** Comissões que exigem ação do Financeiro: valor da conta a lançar ou comissão a aprovar. */
export function listPendingCommissions(companyId: string) {
  return prisma.commission.findMany({
    where: { companyId, OR: [{ amount: null }, { status: { in: ["AWAITING_VALUE", "PENDING"] } }] },
    include: { partner: { select: { id: true, name: true, email: true } }, promotion: { select: { id: true, title: true } }, unit: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 300,
  })
}

/**
 * Contadores do menu e das sub-abas. FONTE ÚNICA: o badge vermelho do menu
 * lateral é a soma EXATA dos badges das abas —
 *   Contas a Pagar (vencidas ou vencendo hoje) + Saques aguardando aprovação
 *   + Recebíveis vencendo hoje.
 */
export async function computeFinanceSummary(companyId: string) {
  const end = endOfToday()
  const [payables, withdrawalsAwaiting, receivablesToday] = await Promise.all([
    listPayables(companyId),
    prisma.withdrawal.count({ where: { companyId, status: "PENDING" } }),
    countReceivablesDueToday(companyId),
  ])
  const tabs = {
    payables: { count: payables.filter((r) => r.dueDate <= end).length, total: payables.length },
    withdrawals: { count: withdrawalsAwaiting },
    receivables: { count: receivablesToday },
  }
  return { tabs, total: tabs.payables.count + tabs.withdrawals.count + tabs.receivables.count }
}
