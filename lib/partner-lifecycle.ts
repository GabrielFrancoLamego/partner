import "server-only"
import { prisma } from "./prisma"
import { notifyPartner } from "./notifications"

const DAY_MS = 24 * 60 * 60 * 1000
const RISK_ZONE_MIN_DAYS = 60
const RISK_ZONE_MAX_DAYS = 89

export type ProgramRiskInfo = {
  programId: string
  companyName: string
  daysInactive: number
  daysUntilTermination: number
}

/** Programas do parceiro na "zona de risco" (60-89 dias sem atividade) — desligamento automático em 90 dias. */
export async function getAtRiskPrograms(partnerId: string): Promise<ProgramRiskInfo[]> {
  const now = Date.now()
  const memberships = await prisma.programMembership.findMany({
    where: { partnerId, status: "ACTIVE" },
    include: { program: { select: { name: true } } },
  })

  return memberships
    .map((m) => {
      const daysInactive = Math.floor((now - m.lastActivityAt.getTime()) / DAY_MS)
      return {
        programId: m.programId,
        companyName: m.program.name,
        daysInactive,
        daysUntilTermination: 90 - daysInactive,
      }
    })
    .filter((r) => r.daysInactive >= RISK_ZONE_MIN_DAYS && r.daysInactive <= RISK_ZONE_MAX_DAYS)
}

/**
 * Resumo mensal consolidado de desempenho — 1 por parceiro/mês (idempotente
 * via checagem de Notification já criada no mês corrente, sem infra de cron:
 * disparado sob demanda no acesso ao /partner, mesmo padrão de
 * lib/license-exemption.ts). Sempre inclui o alerta único de risco quando aplicável.
 */
export async function ensureMonthlyPerformanceNotification(partnerId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const alreadySent = await prisma.notification.findFirst({
    where: { userId: partnerId, type: "PARTNER_PERFORMANCE_MONTHLY", createdAt: { gte: startOfMonth } },
    select: { id: true },
  })
  if (alreadySent) return

  const [approvedAgg, atRisk, activeCount] = await Promise.all([
    prisma.commission.aggregate({
      where: { partnerId, status: "APPROVED", date: { gte: startOfMonth } },
      _sum: { commissionValue: true },
      _count: true,
    }),
    getAtRiskPrograms(partnerId),
    prisma.programMembership.count({ where: { partnerId, status: "ACTIVE" } }),
  ])

  // Sem nenhum vínculo ainda — nada relevante para resumir este mês.
  if (activeCount === 0 && approvedAgg._count === 0) return

  const approvedTotal = Number(approvedAgg._sum.commissionValue ?? 0)
  const lines = [
    `Este mês: ${approvedAgg._count} comissão(ões) aprovada(s), totalizando R$ ${approvedTotal.toFixed(2)}.`,
    `Programas ativos: ${activeCount}.`,
  ]
  if (atRisk.length > 0) {
    lines.push(
      `⚠️ Risco de desligamento automático: ${atRisk
        .map((r) => `${r.companyName} (${r.daysUntilTermination} dias restantes)`)
        .join(", ")}.`,
    )
  }

  await notifyPartner(partnerId, {
    type: "PARTNER_PERFORMANCE_MONTHLY",
    title: atRisk.length > 0 ? "Resumo do mês — atenção, programas em risco" : "Resumo do mês",
    message: lines.join(" "),
    linkUrl: "/partner/explorar",
  })
}
