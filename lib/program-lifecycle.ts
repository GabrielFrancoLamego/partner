import "server-only"
import type { Prisma, Program, ProgramMembership } from "@prisma/client"
import { prisma } from "./prisma"
import { notifyPartners } from "./notifications"

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Saldo pendente (aprovado, ainda não sacado) do parceiro NESTA empresa —
 * partição por companyId do mesmo ledger que soma para PartnerProfile.walletBalance
 * global (COMMISSION/MANUAL_CREDIT somam, WITHDRAWAL/MANUAL_DEBIT subtraem,
 * ver app/api/company/finance/commissions/[id] e app/api/partner/withdrawals).
 * Usado para calcular quanto é perdido ao sair/ser desligado de um programa.
 */
export async function getCompanyWalletBalance(partnerId: string, companyId: string): Promise<number> {
  const rows = await prisma.walletTransaction.groupBy({
    by: ["type"],
    where: { partnerId, companyId },
    _sum: { amount: true },
  })
  let balance = 0
  for (const row of rows) {
    const amount = Number(row._sum.amount ?? 0)
    if (row.type === "COMMISSION" || row.type === "MANUAL_CREDIT") balance += amount
    else balance -= amount
  }
  return Math.round(balance * 100) / 100
}

/** Cria (ou reativa, se tinha saído antes) o vínculo do parceiro a um Program. */
export async function ensureMembership(partnerId: string, program: { id: string; companyId: string }) {
  return prisma.programMembership.upsert({
    where: { programId_partnerId: { programId: program.id, partnerId } },
    update: { status: "ACTIVE", lastActivityAt: new Date(), terminatedAt: null, terminationReason: null, forfeitedBalance: null },
    create: { programId: program.id, companyId: program.companyId, partnerId, status: "ACTIVE" },
  })
}

/**
 * Registra atividade (indicação convertida ou QR gerado) do parceiro numa
 * empresa — chamado da criação de Commission (ver app/api/commissions).
 * Auto-inscreve o parceiro no Program da empresa se ainda não tinha vínculo
 * (fluxo de hoje não passa por um "Participar" explícito antes da 1ª comissão).
 */
export async function touchPartnerActivity(partnerId: string, companyId: string) {
  const program = await prisma.program.findUnique({ where: { companyId }, select: { id: true, companyId: true } })
  if (!program) return
  await prisma.programMembership.upsert({
    where: { programId_partnerId: { programId: program.id, partnerId } },
    update: { lastActivityAt: new Date(), ...(await activeIfNotTerminatedByPartner(program.id, partnerId)) },
    create: { programId: program.id, companyId, partnerId, status: "ACTIVE" },
  })
}

// Reativa automaticamente uma membership desligada por inatividade quando o
// parceiro volta a gerar comissão — mas nunca reverte uma saída voluntária
// (LEFT_BY_PARTNER) ou o fim do programa (PROGRAM_ENDED) por baixo dos panos.
async function activeIfNotTerminatedByPartner(programId: string, partnerId: string) {
  const current = await prisma.programMembership.findUnique({
    where: { programId_partnerId: { programId, partnerId } },
    select: { status: true },
  })
  if (current?.status === "TERMINATED_INACTIVITY") {
    return { status: "ACTIVE" as const, terminatedAt: null, terminationReason: null, forfeitedBalance: null }
  }
  return {}
}

/** Empresa altera regras/comissão de um programa — companies não podem cancelar, só pausar (ver route). */
export async function pauseProgramForNewMembers(program: Program, actorId: string) {
  const now = new Date()
  const pauseEffectiveAt = new Date(now.getTime() + THIRTY_DAYS_MS)

  const updated = await prisma.program.update({
    where: { id: program.id },
    data: { status: "PAUSED_FOR_NEW_MEMBERS", active: false, pausedAt: now, pauseEffectiveAt, archivedAt: null },
  })

  const members = await prisma.programMembership.findMany({
    where: { programId: program.id, status: "ACTIVE" },
    select: { partnerId: true },
  })

  await notifyPartners(members.map((m) => m.partnerId), {
    type: "PROGRAM_PAUSED",
    title: `${program.name} vai encerrar em 30 dias`,
    message: `A empresa pausou "${program.name}" para novas adesões. Você continua com acesso total (saques e QR Codes de promoções ativas) pelos próximos 30 dias — até ${pauseEffectiveAt.toLocaleDateString("pt-BR")}.`,
    linkUrl: `/partner/explorar?programId=${program.id}`,
  })

  return updated
}

/** Reabre um programa pausado para novas adesões. */
export async function reactivateProgram(programId: string) {
  return prisma.program.update({
    where: { id: programId },
    data: { status: "ACTIVE", active: true, pausedAt: null, pauseEffectiveAt: null },
  })
}

/**
 * Arquiva um programa (Admin, ou varredura automática de pausa vencida) —
 * encerra todo vínculo ativo com PROGRAM_ENDED. Diferente de sair/inatividade,
 * não zera o saldo pendente: o parceiro teve os 30 dias de aviso para sacar.
 */
export async function archiveProgram(programId: string, notify = true) {
  const program = await prisma.program.findUnique({ where: { id: programId } })
  if (!program || program.status === "ARCHIVED") return program

  const now = new Date()
  const updated = await prisma.program.update({
    where: { id: programId },
    data: { status: "ARCHIVED", active: false, archivedAt: now, pausedAt: null, pauseEffectiveAt: null },
  })

  const members = await prisma.programMembership.findMany({
    where: { programId, status: "ACTIVE" },
    select: { id: true, partnerId: true },
  })
  if (members.length > 0) {
    await prisma.programMembership.updateMany({
      where: { id: { in: members.map((m) => m.id) } },
      data: { status: "PROGRAM_ENDED", terminatedAt: now, terminationReason: "PROGRAM_ENDED" },
    })
    if (notify) {
      await notifyPartners(members.map((m) => m.partnerId), {
        type: "PROGRAM_MEMBERSHIP_ENDED",
        title: `${program.name} foi encerrado`,
        message: `O programa "${program.name}" foi encerrado. Seu saldo já aprovado continua disponível para saque normalmente.`,
        linkUrl: "/partner/comissoes",
      })
    }
  }

  return updated
}

/** Varredura preguiçosa (sem infra de cron, ver lib/license-exemption.ts): pausas de 30 dias vencidas viram ARCHIVED. */
export async function sweepPauseExpirations() {
  const due = await prisma.program.findMany({
    where: { status: "PAUSED_FOR_NEW_MEMBERS", pauseEffectiveAt: { lte: new Date() } },
    select: { id: true },
  })
  for (const p of due) await archiveProgram(p.id)
}

const RULE_FIELDS: { key: keyof Program; label: string; format?: (v: unknown) => string }[] = [
  { key: "commissionType", label: "Tipo de comissão" },
  { key: "commissionValue", label: "Valor da comissão", format: (v) => String(v) },
  { key: "commissionFormat", label: "Formato do valor" },
  { key: "fixedValue", label: "Valor fixo adicional", format: (v) => (v == null ? "—" : String(v)) },
  { key: "productUnitLabel", label: "Unidade de produto", format: (v) => (v == null ? "—" : String(v)) },
]

/**
 * Compara o Program antes/depois de um PUT/PATCH e, se algum campo de
 * regra/comissão mudou, grava o ProgramChangeLog e notifica todo vínculo
 * ativo com o link de histórico + CTA de aceite/saída (ver task 3).
 */
export async function recordProgramChangeIfNeeded(before: Program, after: Program, actorId: string) {
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  const summaryParts: string[] = []

  for (const field of RULE_FIELDS) {
    const beforeValue = before[field.key]
    const afterValue = after[field.key]
    if (String(beforeValue ?? "") === String(afterValue ?? "")) continue
    changes[field.key] = { before: beforeValue, after: afterValue }
    const fmt = field.format ?? ((v: unknown) => String(v))
    summaryParts.push(`${field.label}: ${fmt(beforeValue)} → ${fmt(afterValue)}`)
  }

  if (String(before.termsContent ?? "") !== String(after.termsContent ?? "")) {
    changes.termsContent = { before: before.termsContent, after: after.termsContent }
    summaryParts.push("Regulamento do programa atualizado")
  }

  if (summaryParts.length === 0) return null

  const summary = summaryParts.join(" · ")

  const log = await prisma.programChangeLog.create({
    data: { programId: after.id, changedById: actorId, summary, changes: changes as Prisma.InputJsonValue },
  })

  const members = await prisma.programMembership.findMany({
    where: { programId: after.id, status: "ACTIVE" },
    select: { partnerId: true },
  })
  await prisma.programMembership.updateMany({
    where: { programId: after.id, status: "ACTIVE" },
    data: { lastChangeAckAt: null },
  })

  await notifyPartners(members.map((m) => m.partnerId), {
    type: "PROGRAM_RULES_CHANGED",
    title: `Regras de "${after.name}" mudaram`,
    message: `${summary}. Veja o histórico completo e confirme se quer continuar no programa.`,
    linkUrl: `/partner/explorar?programId=${after.id}&tab=history`,
  })

  return log
}

/**
 * Saída (voluntária ou por desligamento) de um vínculo — se houver saldo
 * pendente NESTA empresa, ele é perdido (debitado da carteira com um
 * WalletTransaction MANUAL_DEBIT, mesmo padrão de estorno usado no resto do
 * financeiro, ver app/api/company/finance/withdrawals/[id]).
 */
export async function leaveProgramMembership(
  membership: ProgramMembership,
  reason: "LEFT_BY_PARTNER" | "TERMINATED_INACTIVITY",
) {
  const balance = await getCompanyWalletBalance(membership.partnerId, membership.companyId)
  const profile = await prisma.partnerProfile.findUnique({ where: { userId: membership.partnerId }, select: { walletBalance: true } })
  const forfeited = Math.max(0, Math.min(balance, Number(profile?.walletBalance ?? 0)))

  await prisma.$transaction(async (tx) => {
    if (forfeited > 0) {
      await tx.partnerProfile.update({
        where: { userId: membership.partnerId },
        data: { walletBalance: { decrement: forfeited } },
      })
      await tx.walletTransaction.create({
        data: {
          companyId: membership.companyId,
          partnerId: membership.partnerId,
          type: "MANUAL_DEBIT",
          amount: forfeited,
          description:
            reason === "LEFT_BY_PARTNER"
              ? "Saldo perdido — saída voluntária do programa"
              : "Saldo perdido — desligamento automático por 90 dias de inatividade",
          status: "COMPLETED",
        },
      })
    }
    await tx.programMembership.update({
      where: { id: membership.id },
      data: {
        status: reason,
        terminatedAt: new Date(),
        terminationReason: reason,
        forfeitedBalance: forfeited > 0 ? forfeited : null,
      },
    })
  })

  const program = await prisma.program.findUnique({ where: { id: membership.programId }, select: { name: true } })
  await notifyPartners([membership.partnerId], {
    type: "PROGRAM_MEMBERSHIP_ENDED",
    title: reason === "LEFT_BY_PARTNER" ? "Você saiu do programa" : "Desligado por inatividade",
    message:
      reason === "LEFT_BY_PARTNER"
        ? `Sua saída de "${program?.name}" foi confirmada.${forfeited > 0 ? ` Saldo perdido: R$ ${forfeited.toFixed(2)}.` : ""}`
        : `Você foi desligado de "${program?.name}" por 90 dias sem indicações ou QR Codes gerados.${forfeited > 0 ? ` Saldo perdido: R$ ${forfeited.toFixed(2)}.` : ""}`,
    linkUrl: "/partner/explorar",
  })

  return forfeited
}

/** Varredura preguiçosa global (90 dias) — mesmo padrão de lib/license-exemption.ts. */
export async function sweepInactiveMemberships() {
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS)
  const stale = await prisma.programMembership.findMany({
    where: { status: "ACTIVE", lastActivityAt: { lte: cutoff } },
  })
  for (const membership of stale) await leaveProgramMembership(membership, "TERMINATED_INACTIVITY")
}

export async function acknowledgeProgramChange(partnerId: string, programId: string) {
  await prisma.programMembership.updateMany({
    where: { programId, partnerId, status: "ACTIVE" },
    data: { lastChangeAckAt: new Date() },
  })
}
