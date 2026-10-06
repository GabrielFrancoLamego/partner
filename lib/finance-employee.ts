import "server-only"
import type { SettlementPaymentMethod } from "@prisma/client"
import { prisma } from "./prisma"
import { ApiError } from "./api-auth"
import { logAudit } from "./audit"
import { notifyUser } from "./notifications"
import { maybeBlockDiaristaAfterPayment } from "./employment-access"
import { ensureCurrentPayrollEntries, MONTH_NAMES_PT } from "./payroll-engine"
import {
  assertNotSelfPayment,
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

/** Categorias do detalhamento (accordion) dos Recebíveis. */
export type BreakdownCategory = "SALARIO" | "ADIANTAMENTO" | "TAXA_SERVICO" | "DIARIA" | "VALE_CONSUMO" | "METAS_BONUS" | "OUTROS" | "DESCONTOS"

export type BreakdownItem = {
  kind: "OCCURRENCE" | "GOAL_PAYOUT" | "CONSUMPTION"
  /** Para CONSUMPTION é o id do colaborador (saldo devedor corrente da Conta de Consumo). */
  id: string
  category: BreakdownCategory
  label: string
  amount: number
  /** +1 provento (a empresa deve pagar) / -1 desconto (abatido do que é pago). */
  sign: 1 | -1
  status: "PENDING" | "PAID"
  dueDate: Date | null
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
  /** Proventos pendentes. */
  items: FinanceItem[]
  /** Descontos pendentes (Vale, Desconto Especial, Quebra de Caixa, Falta) — abatidos no líquido. */
  discountItems: FinanceItem[]
  /** Quebra completa (proventos e descontos, pagos e pendentes) para o desdobramento da linha. */
  breakdown: BreakdownItem[]
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

export function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function breakdownCategory(o: { type: string; description: string | null }, discount: boolean): BreakdownCategory {
  if (discount) return o.type === "VALE" ? "VALE_CONSUMO" : "DESCONTOS"
  if (o.type === "SALARIO") return o.description?.startsWith("Adiantamento") ? "ADIANTAMENTO" : "SALARIO"
  if (o.type === "TAXA_SERVICO") return "TAXA_SERVICO"
  if (o.type === "DIARIA") return "DIARIA"
  if (o.type === "META" || o.type === "BONUS_ESPECIAL" || o.type === "CUSTOM") return "METAS_BONUS"
  return "OUTROS"
}

/**
 * Projeção financeira do colaborador num mês + o que ainda está a pagar. Fonte
 * única das telas Recebíveis e do pagamento (parcial ou total): Ocorrência é o
 * ledger (Salário/Taxa/Diária/Meta/Bônus/Vale/Descontos) e GoalPayout só entra
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
  const breakdown: BreakdownItem[] = []
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
      breakdown.push({ kind: "OCCURRENCE", id: o.id, category: breakdownCategory(o, true), label: base.label, amount, sign: -1, status, dueDate })
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

    breakdown.push({ kind: "OCCURRENCE", id: o.id, category: breakdownCategory(o, false), label: base.label, amount, sign: 1, status, dueDate })
    if (status === "PENDING") items.push(base)
    else paidEarnings += amount
  }

  for (const p of goalPayouts) {
    const amount = Number(p.amount)
    add(projection.metas, p.status, amount)
    const label = `Meta "${p.goal.name}" (${p.period})`
    const dueDate = p.expectedPaymentDate ?? p.paidAt
    breakdown.push({ kind: "GOAL_PAYOUT", id: p.id, category: "METAS_BONUS", label, amount, sign: 1, status: p.status, dueDate })
    if (p.status === "PENDING") {
      items.push({ kind: "GOAL_PAYOUT", id: p.id, label, amount, status: "PENDING", dueDate, paymentProofUrl: null })
    } else paidEarnings += amount
  }

  const pendingEarnings = round2(items.reduce((s, i) => s + i.amount, 0))
  const discounts = round2(discountItems.reduce((s, i) => s + i.amount, 0))
  const consumo = round2(Number(user.consumptionDebt))
  if (consumo > 0) {
    breakdown.push({ kind: "CONSUMPTION", id: user.id, category: "VALE_CONSUMO", label: "Conta de Consumo Interno (saldo devedor)", amount: consumo, sign: -1, status: "PENDING", dueDate: null })
  }

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
    breakdown,
    totals: { pendingEarnings, paidEarnings: round2(paidEarnings), discounts, consumo, netRemaining: round2(pendingEarnings - discounts - consumo) },
  }
}

const payrollEnsuredAt = new Map<string, number>()
const PAYROLL_ENSURE_TTL_MS = 5 * 60 * 1000

/**
 * Garante os lançamentos de Salário (Adiantamento/Saldo) do mês corrente de
 * todos os colaboradores FIXO/TEMPORARIO — assim as contagens do badge do menu
 * e das abas batem com o que a tela de Recebíveis mostra, mesmo antes de
 * alguém abri-la. Idempotente; limitado a 1x a cada 5 minutos por empresa.
 */
export async function ensurePayrollForCompany(companyId: string) {
  const last = payrollEnsuredAt.get(companyId) ?? 0
  if (Date.now() - last < PAYROLL_ENSURE_TTL_MS) return
  payrollEnsuredAt.set(companyId, Date.now())
  const employees = await prisma.user.findMany({
    where: { companyId, role: "EMPLOYEE", status: "ACTIVE", employeeProfile: { monthlySalary: { not: null }, employmentType: { in: ["FIXO", "TEMPORARIO"] } } },
    select: { id: true, employeeProfile: { select: { monthlySalary: true } } },
  })
  await Promise.all(employees.map((e) => ensureCurrentPayrollEntries(companyId, e.id, Number(e.employeeProfile!.monthlySalary)).catch(() => {})))
}

/**
 * Quantos proventos pendentes de colaboradores vencem até o fim de hoje (mês
 * corrente + atrasados) — usa os MESMOS critérios de computeEmployeeFinance
 * (provento, não abonado, sem a Ocorrência-espelho de meta), em consultas em lote.
 */
export async function countReceivablesDueToday(companyId: string) {
  await ensurePayrollForCompany(companyId)
  const m = parseMonth(null)
  const end = endOfToday()
  const activeEmployee = { status: "ACTIVE" as const, role: "EMPLOYEE" as const, companyId }

  const [occurrences, payouts] = await Promise.all([
    prisma.occurrence.findMany({
      where: {
        companyId,
        employee: activeEmployee,
        total: { not: null },
        paymentStatus: "PENDING",
        OR: [{ date: { lt: m.monthEnd } }, { type: "SALARIO", description: { contains: `(${m.label})` } }],
      },
      select: { type: true, date: true, expectedPaymentDate: true, discountWaived: true, goalPayout: { select: { id: true } }, customType: { select: { salaryImpactType: true } } },
    }),
    prisma.goalPayout.findMany({
      where: { companyId, status: "PENDING", employee: activeEmployee },
      select: { expectedPaymentDate: true, paidAt: true },
    }),
  ])

  const dueOccurrences = occurrences.filter(
    (o) => !o.discountWaived && !(o.type === "META" && o.goalPayout) && !isDiscountOccurrence(o) && isEarningOccurrence(o) && (o.expectedPaymentDate ?? o.date) <= end,
  )
  const duePayouts = payouts.filter((p) => (p.expectedPaymentDate ?? p.paidAt) <= end)
  return dueOccurrences.length + duePayouts.length
}

export type PaymentSelection = { occurrenceIds: string[]; goalPayoutIds: string[]; consumption: boolean }

/**
 * Quita o líquido de um colaborador — TOTAL (todos os proventos pendentes,
 * descontos e consumo) ou PARCIAL (apenas os itens marcados em `selection`).
 * Proventos selecionados viram Pagos, descontos selecionados (Vale etc.) são
 * abatidos, o consumo selecionado zera a Conta de Consumo. Grava UMA quitação
 * com o valor líquido transferido (sourceKind EMPLOYEE_NET).
 */
export async function settleEmployeeNet(p: {
  companyId: string
  userId: string
  employeeId: string
  month: string | null
  method: SettlementPaymentMethod
  file: File
  selection?: PaymentSelection
}) {
  if (p.method === "CONSUMO") throw new ApiError(400, "O líquido já desconta o Consumo Interno — escolha Pix, Dinheiro ou Transferência")
  const fin = await computeEmployeeFinance(p.companyId, p.employeeId, p.month, { ensurePayroll: true })
  if (!fin) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
  assertNotSelfPayment(p.userId, p.employeeId)

  let earnings = fin.items
  let discountRows = fin.discountItems
  let consumo = fin.totals.consumo
  const partial = Boolean(p.selection)
  if (p.selection) {
    const wantedOccurrences = new Set(p.selection.occurrenceIds)
    const wantedPayouts = new Set(p.selection.goalPayoutIds)
    earnings = fin.items.filter((i) => (i.kind === "OCCURRENCE" ? wantedOccurrences.has(i.id) : wantedPayouts.has(i.id)))
    discountRows = fin.discountItems.filter((i) => wantedOccurrences.has(i.id))
    consumo = p.selection.consumption ? fin.totals.consumo : 0
    const knownIds = new Set([...fin.items, ...fin.discountItems].map((i) => i.id))
    const requested = [...wantedOccurrences, ...wantedPayouts]
    if (requested.some((id) => !knownIds.has(id))) throw new ApiError(400, "Há itens selecionados que não estão pendentes para este colaborador")
    if (p.selection.consumption && fin.totals.consumo <= 0) throw new ApiError(400, "O colaborador não tem Conta de Consumo a abater")
  }

  if (earnings.length === 0) throw new ApiError(400, partial ? "Selecione ao menos um provento pendente para pagar" : "Nenhum provento pendente para este colaborador no período")
  const pendingEarnings = round2(earnings.reduce((s, i) => s + i.amount, 0))
  const discounts = round2(discountRows.reduce((s, i) => s + i.amount, 0))
  const net = round2(pendingEarnings - discounts - consumo)
  if (net <= 0) throw new ApiError(400, "Sem saldo líquido a pagar — os descontos e o consumo selecionados cobrem os proventos")

  const proofUrl = await uploadProof(p.file)
  const paidAt = new Date()
  const occurrenceIds = [...earnings.filter((i) => i.kind === "OCCURRENCE"), ...discountRows].map((i) => i.id)
  const goalPayoutIds = earnings.filter((i) => i.kind === "GOAL_PAYOUT").map((i) => i.id)
  const earliestDue = earnings.map((i) => i.dueDate).sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  const settlement = await prisma.$transaction(async (tx) => {
    await tx.occurrence.updateMany({
      where: { id: { in: occurrenceIds }, companyId: p.companyId, paymentStatus: "PENDING" },
      data: { paymentStatus: "PAID", paymentProofUrl: proofUrl, paidAt, paidById: p.userId, paymentMethod: p.method },
    })
    if (goalPayoutIds.length > 0) {
      await tx.goalPayout.updateMany({ where: { id: { in: goalPayoutIds }, companyId: p.companyId, status: "PENDING" }, data: { status: "PAID", paidAt, paidById: p.userId } })
    }
    if (consumo > 0) {
      await tx.user.update({ where: { id: p.employeeId }, data: { consumptionDebt: { decrement: consumo } } })
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
        description: `${partial ? "Itens selecionados" : "Líquido"} ${fin.month} (${earnings.length} provento(s)): ${money(pendingEarnings)} − descontos ${money(discounts + consumo)}`,
        amount: net,
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
    details: { employeeNet: net, month: fin.month, method: p.method, partial },
  })
  await notifyUser({
    userId: p.employeeId,
    type: "PAYMENT_RECEIVED",
    title: "Valor recebido",
    message: `O pagamento de ${money(net)} (${fin.month}) foi registrado.`,
    linkUrl: "/company",
  }).catch(() => {})
  if (earnings.some((i) => i.label.startsWith("Diária"))) await maybeBlockDiaristaAfterPayment(p.companyId, p.employeeId).catch(() => {})

  return settlement
}
