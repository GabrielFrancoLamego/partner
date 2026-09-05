import "server-only"
import type { Prisma, XpReason } from "@prisma/client"
import { prisma } from "./prisma"

/**
 * Concede (ou deduz, com `points` negativo) XP a um colaborador: grava o
 * lançamento em XpEntry e ajusta o saldo corrente em EmployeeProfile.xpPoints
 * na mesma transação. `tx` opcional permite compor com outras escritas
 * (ex: aprovar um checklist e premiar XP no mesmo `$transaction`).
 */
export async function awardXp(
  params: {
    companyId: string
    employeeId: string
    reason: XpReason
    points: number
    sourceId?: string | null
    note?: string | null
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (params.points === 0) return null

  const [entry] = await Promise.all([
    tx.xpEntry.create({
      data: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        reason: params.reason,
        points: params.points,
        sourceId: params.sourceId ?? null,
        note: params.note ?? null,
      },
    }),
    tx.employeeProfile.update({
      where: { userId: params.employeeId },
      data: { xpPoints: { increment: params.points } },
    }),
  ])

  return entry
}

/** Todo colaborador "inicia o mês" com esta base — somada ao extrato de XpEntry do mês corrente (sem job de reset: é sempre recalculada). */
export const MONTHLY_BASE_XP = 30

/** Extrato de Pontos do Mês: base mensal + soma de XpEntry desde o dia 1 do mês corrente. */
export async function getMonthlyScore(companyId: string, employeeId: string, now = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const agg = await prisma.xpEntry.aggregate({
    where: { companyId, employeeId, createdAt: { gte: startOfMonth } },
    _sum: { points: true },
  })
  return MONTHLY_BASE_XP + (agg._sum.points ?? 0)
}

export type EfficiencyMedal = { stars: 1 | 2 | 3 | 4 | 5; label: string; colorHex: string; efficiencyPercent: number }

/** Sistema de Medalhas de Eficiência Diária — faixas fixas do "Modo Game". */
export function resolveEfficiencyMedal(efficiencyPercent: number): EfficiencyMedal {
  if (efficiencyPercent >= 100) return { stars: 5, label: "Dourado Brilhante", colorHex: "#FFD700", efficiencyPercent }
  if (efficiencyPercent >= 90) return { stars: 4, label: "Ouro", colorHex: "#EAB308", efficiencyPercent }
  if (efficiencyPercent >= 75) return { stars: 3, label: "Prata", colorHex: "#9CA3AF", efficiencyPercent }
  if (efficiencyPercent >= 50) return { stars: 2, label: "Bronze", colorHex: "#B45309", efficiencyPercent }
  return { stars: 1, label: "Alerta", colorHex: "#EF4444", efficiencyPercent }
}

/**
 * Eficiência do turno de hoje = média entre conclusão do Ponto Digital (quantas
 * das 4 batidas esperadas já ocorreram) e cumprimento de Checklists (aprovados
 * hoje / tarefas recorrentes ativas). Heurística — não há um "esperado por dia"
 * explícito no schema, então usamos os templates ativos como proxy.
 */
export async function computeDailyEfficiency(companyId: string, employeeId: string, day = new Date()) {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const [entriesToday, activeTemplateCount, approvedToday] = await Promise.all([
    prisma.timeEntry.count({ where: { companyId, userId: employeeId, createdAt: { gte: start, lt: end } } }),
    prisma.checklistTemplate.count({ where: { companyId, active: true } }),
    prisma.checklist.count({
      where: { companyId, employeeId, status: "APPROVED", createdAt: { gte: start, lt: end } },
    }),
  ])

  const pontoScore = Math.min(100, (entriesToday / 4) * 100)
  const checklistScore = activeTemplateCount > 0 ? Math.min(100, (approvedToday / activeTemplateCount) * 100) : 100
  const efficiencyPercent = Math.round((pontoScore + checklistScore) / 2)

  return { efficiencyPercent, medal: resolveEfficiencyMedal(efficiencyPercent) }
}

export type CareerProgress = {
  currentLevel: { id: string; name: string; order: number; requiredXp: number; badgeColorHex: string } | null
  nextLevel: { id: string; name: string; order: number; requiredXp: number; badgeColorHex: string } | null
  xpPoints: number
  progressToNextPercent: number
}

/**
 * Deriva o nível atual e o progresso até o próximo degrau da régua de
 * cargos a partir do saldo de XP — o nível não é persistido no colaborador,
 * é sempre recalculado contra CareerLevel.requiredXp (fonte da verdade).
 */
export function resolveCareerProgress(
  xpPoints: number,
  levels: { id: string; name: string; order: number; requiredXp: number; badgeColorHex: string }[],
): CareerProgress {
  const sorted = [...levels].sort((a, b) => a.requiredXp - b.requiredXp)
  let currentLevel: CareerProgress["currentLevel"] = null
  let nextLevel: CareerProgress["nextLevel"] = null

  for (const level of sorted) {
    if (xpPoints >= level.requiredXp) {
      currentLevel = level
    } else {
      nextLevel = level
      break
    }
  }

  let progressToNextPercent = 100
  if (nextLevel) {
    const floor = currentLevel?.requiredXp ?? 0
    const span = nextLevel.requiredXp - floor
    progressToNextPercent = span > 0 ? Math.max(0, Math.min(100, Math.round(((xpPoints - floor) / span) * 100))) : 0
  }

  return { currentLevel, nextLevel, xpPoints, progressToNextPercent }
}
