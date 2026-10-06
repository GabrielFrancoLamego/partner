import "server-only"
import type { OccurrencePaymentMethod, OccurrenceType, Prisma, SettlementPaymentMethod, SettlementSourceKind } from "@prisma/client"
import { prisma } from "./prisma"
import { ApiError } from "./api-auth"
import { uploadImage } from "./storage"
import { logAudit } from "./audit"
import { notifyUser } from "./notifications"
import { maybeBlockDiaristaAfterPayment } from "./employment-access"

export const SETTLEMENT_METHODS: SettlementPaymentMethod[] = ["PIX", "DINHEIRO", "TRANSFERENCIA", "CONSUMO"]
const PROOF_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]
const MAX_PROOF_BYTES = 8 * 1024 * 1024

export const OCCURRENCE_TYPE_LABELS: Record<string, string> = {
  SALARIO: "Salário Fixo",
  TAXA_SERVICO: "Taxa de Serviço",
  DIARIA: "Diária",
  COMPRA_DOMINGO: "Compra de Domingo",
  META: "Bonificação de Meta",
  VALE: "Vale/Adiantamento",
  HORA_EXTRA: "Hora Extra",
  BANCO_HORAS: "Banco de Horas",
  BONUS_ESPECIAL: "Bônus Especial",
  DESCONTO_ESPECIAL: "Desconto Especial",
  QUEBRA_CAIXA: "Quebra de Caixa",
  FALTA: "Falta (desconto)",
  CONSUMO: "Consumo",
  CUSTOM: "Lançamento Configurável",
}

/** Tipos de ocorrência que SOMAM ao que a empresa deve ao colaborador (CUSTOM entra por customType.salaryImpactType = BONUS). */
export const EARNING_OCCURRENCE_TYPES: OccurrenceType[] = ["SALARIO", "TAXA_SERVICO", "DIARIA", "COMPRA_DOMINGO", "META", "HORA_EXTRA", "BONUS_ESPECIAL"]
/** Tipos que ABATEM do líquido do colaborador (CUSTOM entra por customType.salaryImpactType = DISCOUNT). */
export const DISCOUNT_OCCURRENCE_TYPES: OccurrenceType[] = ["VALE", "DESCONTO_ESPECIAL", "QUEBRA_CAIXA", "FALTA"]

/** Separação de funções: ninguém quita um pagamento em seu próprio nome (ex: Financeiro pagando a si mesmo). */
export function assertNotSelfPayment(payerId: string, payeeId: string | null) {
  if (payeeId && payerId === payeeId) throw new ApiError(403, "Você não pode quitar um pagamento em seu próprio nome — peça a outro responsável")
}

export function parsePaymentMethod(raw: unknown): SettlementPaymentMethod {
  if (typeof raw !== "string" || !SETTLEMENT_METHODS.includes(raw as SettlementPaymentMethod)) {
    throw new ApiError(400, "Selecione a forma de pagamento (Pix, Dinheiro, Transferência Bancária ou Consumo Interno)")
  }
  return raw as SettlementPaymentMethod
}

/** Comprovante é obrigatório em toda quitação — imagem PNG/JPG ou PDF, até 8MB. */
export function parseProofFile(raw: unknown): File {
  if (!(raw instanceof File) || raw.size === 0) throw new ApiError(400, "Comprovante de pagamento é obrigatório (imagem PNG/JPG ou PDF)")
  if (raw.size > MAX_PROOF_BYTES) throw new ApiError(400, "Comprovante excede 8MB")
  if (!PROOF_MIME_TYPES.includes(raw.type)) throw new ApiError(400, "Formato do comprovante não suportado — envie PNG, JPG ou PDF")
  return raw
}

export async function uploadProof(file: File): Promise<string> {
  try {
    return await uploadImage("receipts", file)
  } catch {
    throw new ApiError(502, "Falha ao enviar o comprovante. Verifique sua conexão e tente novamente.")
  }
}

type BankingFields = {
  cpf: string | null
  fullName?: string | null
  document?: string | null
  bankName: string | null
  accountType: string | null
  agency: string | null
  accountNumber: string | null
  pixKey: string | null
}

export type RecipientBanking = {
  fullName: string
  document: string | null
  bankName: string | null
  accountType: string | null
  agency: string | null
  accountNumber: string | null
  pixKey: string | null
}

/** Dados do favorecido prontos para exibir/exportar — nome completo do cadastro quando houver, senão o nome de exibição. */
export function toRecipientBanking(displayName: string, profile: BankingFields | null | undefined): RecipientBanking {
  return {
    fullName: profile?.fullName?.trim() || displayName,
    document: profile?.cpf ?? profile?.document ?? null,
    bankName: profile?.bankName ?? null,
    accountType: profile?.accountType ?? null,
    agency: profile?.agency ?? null,
    accountNumber: profile?.accountNumber ?? null,
    pixKey: profile?.pixKey ?? null,
  }
}

export const BANKING_SELECT = {
  cpf: true,
  fullName: true,
  bankName: true,
  accountType: true,
  agency: true,
  accountNumber: true,
  pixKey: true,
} as const

export function occurrenceLabel(o: { type: string; description: string | null; customType?: { name: string } | null }) {
  const base = o.type === "CUSTOM" ? o.customType?.name ?? "Lançamento" : OCCURRENCE_TYPE_LABELS[o.type] ?? o.type
  return o.description ? `${base} — ${o.description}` : base
}

type SettlementInput = {
  companyId: string
  sourceKind: SettlementSourceKind
  sourceId: string
  recipientType: "PARTNER" | "EMPLOYEE" | "EXTERNAL"
  recipientId: string | null
  recipientName: string
  recipientDocument: string | null
  pixKey: string | null
  description: string
  amount: number
  dueDate: Date | null
  paymentMethod: SettlementPaymentMethod
  proofUrl: string
  paidById: string
}

/**
 * Grava a quitação (extrato do módulo Financeiro). Sempre chamada dentro da
 * mesma transação que muda o status do compromisso de origem.
 *
 * PONTO DE INTEGRAÇÃO — OMIE ERP (futuro): após gravar a quitação, enfileirar o
 * envio do lançamento ao Omie (incluir conta a pagar + baixa) e preencher
 * `omieCodigoLancamento`/`omieStatus` ('Pendente' → 'Sincronizado' → 'Pago_Omie').
 * O retorno do Omie chegará por webhook (rota a criar em app/api/webhooks/omie),
 * que atualiza esses mesmos campos em FinancialSettlement e nas tabelas de
 * origem (Withdrawal/Occurrence/GoalPayout).
 */
function createSettlement(tx: Prisma.TransactionClient, input: SettlementInput) {
  return tx.financialSettlement.create({ data: { ...input, omieStatus: null } })
}

function asOccurrenceMethod(method: SettlementPaymentMethod): OccurrencePaymentMethod {
  return method as OccurrencePaymentMethod
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export async function settleWithdrawal(p: { companyId: string; userId: string; withdrawalId: string; method: SettlementPaymentMethod; file: File }) {
  const withdrawal = await prisma.withdrawal.findFirst({
    where: { id: p.withdrawalId, companyId: p.companyId },
    include: { partner: { select: { id: true, name: true, partnerProfile: { select: { ...BANKING_SELECT, document: true } } } } },
  })
  if (!withdrawal) throw new ApiError(404, "Saque não encontrado")
  if (withdrawal.status !== "APPROVED") throw new ApiError(400, "Só saques aprovados podem ser pagos")
  if (p.method === "CONSUMO") throw new ApiError(400, "Consumo Interno só se aplica a pagamentos a colaboradores")

  const banking = toRecipientBanking(withdrawal.partner.name, withdrawal.partner.partnerProfile)
  const proofUrl = await uploadProof(p.file)
  const amount = Number(withdrawal.amount)

  const settlement = await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "PAID", paidAt: new Date(), proofOfPaymentUrl: proofUrl } })
    return createSettlement(tx, {
      companyId: p.companyId,
      sourceKind: "WITHDRAWAL",
      sourceId: withdrawal.id,
      recipientType: "PARTNER",
      recipientId: withdrawal.partnerId,
      recipientName: banking.fullName,
      recipientDocument: banking.document,
      pixKey: withdrawal.pixKey ?? banking.pixKey,
      description: "Saque PIX de parceiro",
      amount,
      dueDate: withdrawal.expectedPaymentDate ?? withdrawal.approvedAt ?? withdrawal.requestDate,
      paymentMethod: p.method,
      proofUrl,
      paidById: p.userId,
    })
  })

  await logAudit({ userId: p.userId, companyId: p.companyId, action: "PIX_APPROVAL", entity: "Withdrawal", entityId: withdrawal.id, details: { status: "PAID", method: p.method } })
  await notifyUser({
    userId: withdrawal.partnerId,
    type: "PAYMENT_RECEIVED",
    title: "Saque pago",
    message: `Seu saque de ${money(amount)} foi pago. O comprovante está disponível em Meus Saques.`,
    linkUrl: "/partner/carteira/saques",
  }).catch(() => {})

  return settlement
}

export async function settleOccurrence(p: { companyId: string; userId: string; occurrenceId: string; method: SettlementPaymentMethod; file: File }) {
  const occ = await prisma.occurrence.findFirst({
    where: { id: p.occurrenceId, companyId: p.companyId },
    include: {
      employee: { select: { id: true, name: true, consumptionDebt: true, employeeProfile: { select: BANKING_SELECT } } },
      customType: { select: { name: true, salaryImpactType: true } },
    },
  })
  if (!occ) throw new ApiError(404, "Ocorrência não encontrada")
  if (occ.paymentStatus === "PAID") throw new ApiError(400, "Esta ocorrência já está marcada como paga")
  if (occ.total === null) throw new ApiError(400, "Esta ocorrência não tem valor financeiro para quitar")
  assertNotSelfPayment(p.userId, occ.employeeId)
  if (isDiscountOccurrence(occ)) {
    throw new ApiError(400, "Descontos não são pagos individualmente — são abatidos ao quitar o líquido do colaborador")
  }

  const amount = Math.abs(Number(occ.total))
  if (p.method === "CONSUMO") {
    if (!occ.employee) throw new ApiError(400, "Consumo Interno só se aplica a pagamentos a colaboradores")
    if (Number(occ.employee.consumptionDebt) < amount) {
      throw new ApiError(400, `Conta de Consumo insuficiente — saldo devedor do colaborador é ${money(Number(occ.employee.consumptionDebt))}`)
    }
  }

  const banking = occ.employee ? toRecipientBanking(occ.employee.name, occ.employee.employeeProfile) : null
  const proofUrl = await uploadProof(p.file)

  const settlement = await prisma.$transaction(async (tx) => {
    await tx.occurrence.update({
      where: { id: occ.id },
      data: { paymentStatus: "PAID", paymentProofUrl: proofUrl, paidAt: new Date(), paidById: p.userId, paymentMethod: asOccurrenceMethod(p.method) },
    })
    if (p.method === "CONSUMO" && occ.employeeId) {
      await tx.user.update({ where: { id: occ.employeeId }, data: { consumptionDebt: { decrement: amount } } })
    }
    return createSettlement(tx, {
      companyId: p.companyId,
      sourceKind: "OCCURRENCE",
      sourceId: occ.id,
      recipientType: occ.employee ? "EMPLOYEE" : "EXTERNAL",
      recipientId: occ.employeeId,
      recipientName: banking?.fullName ?? occ.employeeNameFreeText ?? "Favorecido sem cadastro",
      recipientDocument: banking?.document ?? null,
      pixKey: banking?.pixKey ?? null,
      description: occurrenceLabel(occ),
      amount,
      dueDate: occ.expectedPaymentDate ?? occ.date,
      paymentMethod: p.method,
      proofUrl,
      paidById: p.userId,
    })
  })

  await logAudit({ userId: p.userId, companyId: p.companyId, action: "MARK_PAID", entity: "Occurrence", entityId: occ.id, details: { method: p.method } })

  if (occ.employeeId) {
    await notifyUser({
      userId: occ.employeeId,
      type: "PAYMENT_RECEIVED",
      title: "Valor recebido",
      message: `O pagamento de "${occurrenceLabel(occ)}" (${money(amount)}) foi registrado.`,
      linkUrl: "/company",
    }).catch(() => {})
    // Regra do DIARISTA: confirmar o pagamento da diária bloqueia o acesso (ver lib/employment-access.ts).
    if (occ.type === "DIARIA") await maybeBlockDiaristaAfterPayment(p.companyId, occ.employeeId).catch(() => {})
  }

  return settlement
}

export async function settleGoalPayout(p: { companyId: string; userId: string; goalPayoutId: string; method: SettlementPaymentMethod; file: File }) {
  const payout = await prisma.goalPayout.findFirst({
    where: { id: p.goalPayoutId, companyId: p.companyId },
    include: {
      goal: { select: { name: true } },
      employee: { select: { id: true, name: true, consumptionDebt: true, employeeProfile: { select: BANKING_SELECT } } },
    },
  })
  if (!payout) throw new ApiError(404, "Bônus de meta não encontrado")
  if (payout.status === "PAID") throw new ApiError(400, "Este bônus já está pago")
  assertNotSelfPayment(p.userId, payout.employeeId)

  const amount = Number(payout.amount)
  if (p.method === "CONSUMO" && Number(payout.employee.consumptionDebt) < amount) {
    throw new ApiError(400, `Conta de Consumo insuficiente — saldo devedor do colaborador é ${money(Number(payout.employee.consumptionDebt))}`)
  }

  const banking = toRecipientBanking(payout.employee.name, payout.employee.employeeProfile)
  const proofUrl = await uploadProof(p.file)

  const settlement = await prisma.$transaction(async (tx) => {
    await tx.goalPayout.update({ where: { id: payout.id }, data: { status: "PAID", paidAt: new Date(), paidById: p.userId } })
    if (p.method === "CONSUMO") await tx.user.update({ where: { id: payout.employeeId }, data: { consumptionDebt: { decrement: amount } } })
    return createSettlement(tx, {
      companyId: p.companyId,
      sourceKind: "GOAL_PAYOUT",
      sourceId: payout.id,
      recipientType: "EMPLOYEE",
      recipientId: payout.employeeId,
      recipientName: banking.fullName,
      recipientDocument: banking.document,
      pixKey: banking.pixKey,
      description: `Meta "${payout.goal.name}" (${payout.period})`,
      amount,
      dueDate: payout.expectedPaymentDate ?? payout.paidAt,
      paymentMethod: p.method,
      proofUrl,
      paidById: p.userId,
    })
  })

  await logAudit({ userId: p.userId, companyId: p.companyId, action: "MARK_PAID", entity: "GoalPayout", entityId: payout.id, details: { method: p.method } })
  await notifyUser({
    userId: payout.employeeId,
    type: "PAYMENT_RECEIVED",
    title: "Valor recebido",
    message: `O pagamento da meta "${payout.goal.name}" (${money(amount)}) foi registrado.`,
    linkUrl: "/company",
  }).catch(() => {})
  return settlement
}

/** Ocorrência cujo valor ABATE do líquido (Vale, Desconto Especial, Quebra de Caixa, Falta e tipos configuráveis de desconto). */
export function isDiscountOccurrence(o: { type: OccurrenceType; customType?: { salaryImpactType: string | null } | null }) {
  if (o.type === "CUSTOM") return o.customType?.salaryImpactType === "DISCOUNT"
  return DISCOUNT_OCCURRENCE_TYPES.includes(o.type)
}

/** Ocorrência cujo valor a empresa DEVE pagar ao colaborador. */
export function isEarningOccurrence(o: { type: OccurrenceType; customType?: { salaryImpactType: string | null } | null }) {
  if (o.type === "CUSTOM") return o.customType?.salaryImpactType === "BONUS"
  return EARNING_OCCURRENCE_TYPES.includes(o.type)
}
