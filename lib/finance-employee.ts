import "server-only"
import type { SettlementPaymentMethod } from "@prisma/client"
import { prisma } from "./prisma"
import { ApiError } from "./api-auth"
import { logAudit } from "./audit"
import { notifyUser } from "./notifications"
import { maybeBlockDiaristaAfterPayment } from "./employment-access"
import { ensureCurrentPayrollEntries, MONTH_NAMES_PT } from "./payroll-engine"
import {
  BANKING_SELECT,
  isDiscountOccurrence,
  isEarningOccurrence,
  occurrenceLabel,
  toRecipientBanking,
  uploadProof,
  type RecipientBanking,
} from "./finance-settlement"

const round2 = (v: number) => Math.round(v * 100) / 100
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type FinanceItem = {
  kind: "OCCURRENCE" | "GOAL_PAYOUT"
  id: string
  label: string
  amount: number
  status: "PENDING" | "PAID"
  dueDate: Date
  paymentProofUrl: string | null
}

type Bucket = { paid: number; pending: number }

export type EmployeeFinance = {
  employeeId: string
  name: string
  employmentType: string | null
  banking: RecipientBanking
  consumptionDebt: number
  month: string
  monthlySalary: number
  /** Projeção do mês: cada coluna com o que já foi pago e o que segue pendente. */
  projection: {
    adiantamento: Bucket & { dueDate: Date | null }
    saldoSalario: Bucket & { dueDate: Date | null }
    taxaServico: Bucket
    metas: Bucket
    outrosAdicionais: Bucket
  }
  /** Proventos pendentes — pagos individualmente ou em "Pagar total líquido". */
  items: FinanceItem[]
  /** Descontos pendentes (Vale, Desconto Especial, Quebra de Caixa, Falta) — abatidos no líquido. */
  discountItems: FinanceItem[]
  totals: { pendingEarnings: number; paidEarnings: number; discounts: number; consumo: number; netRemaining: number }
}

export function parseMonth(param: string | null) {
  const now = new Date()
  const match = param && /^(\d{4})-(\d{2})$/.exec(param)
  const year = match ? Number(match[1]) : now.getFullYear()
  const month = match ? Number(match[2]) - 1 : now.getMonth()
  return {
    year,
    month,
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: `${MONTH_NAMES_PT[month]}/${year}`,
    monthStart: new Date(year, month, 1),
    monthEnd: new Date(year, month + 1, 1),
    ref: new Date(year, month, 1),
  }
}

/**
 * Projeção financeira do colaborador num mês + o que ainda está a pagar. Fonte
 * única das telas Recebíveis e "Pagar total líquido": Ocorrência é o ledger
 * (Salário/Taxa/Diária/Meta/Bônus/Vale/Descontos) e GoalPayout só entra
 * quando PENDING (a Ocorrência-espelho da meta é ignorada para não duplicar).
 */
export async function computeEmployeeFinance(companyId: string, employeeId: string, monthParam: string | null, opts: { ensurePayroll?: boolean } = {}): Promise<EmployeeFinance | null> {
  const m = parseMonth(monthParam)

  const user = await prisma.user.findFirst({
    where: { id: employeeId, companyId, role: "EMPLOYEE" },
    select: { id: true, name: true, consumptionDebt: true, employeeProfile: { select: { ...BANKING_SELECT, monthlySalary: true, employmentType: true } } },
  })
  if (!user) return null
  const profile = user.employeeProfile

  if (opts.ensurePayroll && profile?.employmentType !== "DIARISTA" && profile?.monthlySalary) {
    await ensureCurrentPayrollEntries(companyId, employeeId, Number(profile.monthlySalary), m.ref).catch(() => {})
  }

  const [occurrences, goalPayouts] = await Promise.all([
    prisma.occurrence.findMany({
      where: {
        companyId,
        employeeId,
        total: { not: null },
        OR: [
          { paymentStatus: "PENDING", date: { lt: m.monthEnd } },
          { date: { gte: m.monthStart, lt: m.monthEnd } },
          { type: "SALARIO", description: { contains: `(${m.label})` } },
        ],
      },
      select: {
        id: true,
        type: true,
        total: true,
        paymentStatus: true,
        date: true,
        expectedPaymentDate: true,
        description: true,
        paymentProofUrl: true,
        discountWaived: true,
        goalPayout: { select: { id: true } },
        customType: { select: { name: true, salaryImpactType: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.goalPayout.findMany({
      where: { companyId, employeeId, OR: [{ status: "PENDING" }, { period: m.key }] },
      select: { id: true, amount: true, status: true, period: true, paidAt: true, expectedPaymentDate: true, goal: { select: { name: true } } },
    }),
  ])

  const bucket = (): Bucket => ({ paid: 0, pending: 0 })
  const projection: EmployeeFinance["projection"] = {
    adiantamento: { ...bucket(), dueDate: null },
    saldoSalario: { ...bucket(), dueDate: null },
    taxaServico: bucket(),
    metas: bucket(),
    outrosAdicionais: bucket(),
  }
  const items: FinanceItem[] = []
  const discountItems: FinanceItem[] = []
  let paidEarnings = 0

  const add = (b: Bucket, status: "PENDING" | "PAID", amount: number) => {
    if (status === "PAID") b.paid += amount
    else b.pending += amount
  }

  for (const o of occurrences) {
    if (o.discountWaived) continue
    if (o.type === "META" && o.goalPayout) continue
    const amount = Math.abs(Number(o.total))
    const status = o.paymentStatus
    const dueDate = o.expectedPaymentDate ?? o.date
    const base = { kind: "OCCURRENCE" as const, id: o.id, label: occurrenceLabel(o), amount, status, dueDate, paymentProofUrl: o.paymentProofUrl }

    if (isDiscountOccurrence(o)) {
      if (status === "PENDING") discountItems.push(base)
      continue
    }
    if (!isEarningOccurrence(o)) continue

    if (o.type === "SALARIO") {
      const target = o.description?.startsWith("Adiantamento") ? projection.adiantamento : projection.saldoSalario
      add(target, status, amount)
      target.dueDate = dueDate
    } else if (o.type === "TAXA_SERVICO") add(projection.taxaServico, status, amount)
    else if (o.type === "META" || o.type === "BONUS_ESPECIAL" || o.type === "CUSTOM") add(projection.metas, status, amount)
    else add(projection.outrosAdicionais, status, amount)

    if (status === "PENDING") items.push(base)
    else paidEarnings += amount
  }

  for (const p of goalPayouts) {
    const amount = Number(p.amount)
    add(projection.metas, p.status, amount)
    if (p.status === "PENDING") {
      items.push({
        kind: "GOAL_PAYOUT",
        id: p.id,
        label: `Meta "${p.goal.name}" (${p.period})`,
        amount,
        status: "PENDING",
        dueDate: p.expectedPaymentDate ?? p.paidAt,
        paymentProofUrl: null,
      })
    } else paidEarnings += amount
  }

  const pendingEarnings = round2(items.reduce((s, i) => s + i.amount, 0))
  const discounts = round2(discountItems.reduce((s, i) => s + i.amount, 0))
  const consumo = round2(Number(user.consumptionDebt))

  return {
    employeeId: user.id,
    name: user.name,
    employmentType: profile?.employmentType ?? null,
    banking: toRecipientBanking(user.name, profile),
    consumptionDebt: consumo,
    month: m.key,
    monthlySalary: Number(profile?.monthlySalary ?? 0),
    projection,
    items,
    discountItems,
    totals: { pendingEarnings, paidEarnings: round2(paidEarnings), discounts, consumo, netRemaining: round2(pendingEarnings - discounts - consumo) },
  }
}

/**
 * "PAGAR TOTAL LÍQUIDO" — quita de uma vez o líquido do mês do colaborador:
 * todos os proventos pendentes viram Pagos, os descontos pendentes (Vale etc.)
 * são abatidos e a Conta de Consumo devida é zerada. Grava UMA quitação com o
 * valor líquido transferido (sourceKind EMPLOYEE_NET).
 */
export async function settleEmployeeNet(p: { companyId: string; userId: string; employeeId: string; month: string | null; method: SettlementPaymentMethod; file: File }) {
  if (p.method === "CONSUMO") throw new ApiError(400, "O líquido já desconta o Consumo Interno — escolha Pix, Dinheiro ou Transferência")
  const fin = await computeEmployeeFinance(p.companyId, p.employeeId, p.month, { ensurePayroll: true })
  if (!fin) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
  if (fin.items.length === 0) throw new ApiError(400, "Nenhum provento pendente para este colaborador no período")
  if (fin.totals.netRemaining <= 0) throw new ApiError(400, "Sem saldo líquido a pagar — os descontos e o consumo cobrem os proventos pendentes")

  const proofUrl = await uploadProof(p.file)
  const paidAt = new Date()
  const occurrenceIds = [...fin.items.filter((i) => i.kind === "OCCURRENCE"), ...fin.discountItems].map((i) => i.id)
  const goalPayoutIds = fin.items.filter((i) => i.kind === "GOAL_PAYOUT").map((i) => i.id)
  const earliestDue = fin.items.map((i) => i.dueDate).sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  const settlement = await prisma.$transaction(async (tx) => {
    await tx.occurrence.updateMany({
      where: { id: { in: occurrenceIds }, companyId: p.companyId, paymentStatus: "PENDING" },
      data: { paymentStatus: "PAID", paymentProofUrl: proofUrl, paidAt, paidById: p.userId, paymentMethod: p.method },
    })
    if (goalPayoutIds.length > 0) {
      await tx.goalPayout.updateMany({ where: { id: { in: goalPayoutIds }, companyId: p.companyId, status: "PENDING" }, data: { status: "PAID", paidAt, paidById: p.userId } })
    }
    if (fin.totals.consumo > 0) {
      await tx.user.update({ where: { id: p.employeeId }, data: { consumptionDebt: { decrement: fin.totals.consumo } } })
    }
    return tx.financialSettlement.create({
      data: {
        companyId: p.companyId,
        sourceKind: "EMPLOYEE_NET",
        sourceId: p.employeeId,
        recipientType: "EMPLOYEE",
        recipientId: p.employeeId,
        recipientName: fin.banking.fullName,
        recipientDocument: fin.banking.document,
        pixKey: fin.banking.pixKey,
        description: `Líquido ${fin.month}: proventos ${money(fin.totals.pendingEarnings)} − descontos ${money(fin.totals.discounts + fin.totals.consumo)}`,
        amount: fin.totals.netRemaining,
        dueDate: earliestDue,
        paymentMethod: p.method,
        proofUrl,
        paidById: p.userId,
      },
    })
  })

  await logAudit({
    userId: p.userId,
    companyId: p.companyId,
    action: "MARK_PAID",
    entity: "User",
    entityId: p.employeeId,
    details: { employeeNet: fin.totals.netRemaining, month: fin.month, method: p.method },
  })
  await notifyUser({
    userId: p.employeeId,
    type: "GENERIC",
    title: "Pagamento realizado",
    message: `O pagamento líquido de ${money(fin.totals.netRemaining)} (${fin.month}) foi registrado.`,
    linkUrl: "/company",
  }).catch(() => {})
  await maybeBlockDiaristaAfterPayment(p.companyId, p.employeeId).catch(() => {})

  return settlement
}
