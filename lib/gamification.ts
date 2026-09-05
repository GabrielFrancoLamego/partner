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

type LevelLike = { id: string; name: string; order: number; pointsRequired: number; badgeColorHex: string }

export type CareerProgress = {
  currentLevel: LevelLike | null
  nextLevel: LevelLike | null
  xpPoints: number
  progressToNextPercent: number
}

/**
 * Nível atual = EmployeeProfile.currentInternalLevelId (ponteiro explícito;
 * cai no degrau de menor `order` se ainda não foi definido). `xpPoints` conta
 * SÓ desde a última promoção — REGRA DE MUDANÇA DE CARGO: promover zera
 * xpPoints e move o ponteiro (ver promoteEmployee abaixo), então o progresso
 * aqui é sempre relativo ao `pointsRequired` do nível atual, nunca cumulativo
 * contra a régua inteira.
 */
export function resolveCareerProgress(xpPoints: number, levels: LevelLike[], currentLevelId: string | null): CareerProgress {
  const sorted = [...levels].sort((a, b) => a.order - b.order)
  const currentLevel = (currentLevelId ? sorted.find((l) => l.id === currentLevelId) : sorted[0]) ?? sorted[0] ?? null
  const nextLevel = currentLevel ? (sorted.find((l) => l.order === currentLevel.order + 1) ?? null) : null

  const progressToNextPercent =
    currentLevel && currentLevel.pointsRequired > 0
      ? Math.max(0, Math.min(100, Math.round((xpPoints / currentLevel.pointsRequired) * 100)))
      : 0

  return { currentLevel, nextLevel, xpPoints, progressToNextPercent }
}

/**
 * Promove um colaborador para um novo nível do Programa Interno — zera
 * xpPoints (novo ciclo de pontuação começa do zero no cargo novo, regra
 * explícita do produto) e registra o motivo em AuditLog (chamador loga).
 */
export async function promoteEmployee(employeeId: string, newLevelId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.employeeProfile.update({
    where: { userId: employeeId },
    data: { currentInternalLevelId: newLevelId, xpPoints: 0 },
  })
}

export type InternalProgramRules = {
  pointsOnTimeCheckIn: number
  pointsChecklistOnTime: number
  pointsChecklistLateOrRejected: number
  pointsOccurrencePenalty: number
  minEfficiencyPercent: number
  efficiencyBonusAmount: number | null
}

const DEFAULT_INTERNAL_PROGRAM_RULES: InternalProgramRules = {
  pointsOnTimeCheckIn: 5,
  pointsChecklistOnTime: 5,
  pointsChecklistLateOrRejected: -3,
  pointsOccurrencePenalty: -10,
  minEfficiencyPercent: 90,
  efficiencyBonusAmount: null,
}

/** Garante que a empresa tenha um InternalProgram (cria um rascunho padrão na primeira vez que algo precisa dele — ex: cadastrar o 1º nível antes de a Master preencher o resto do programa em /company/programa-interno). */
export async function getOrCreateInternalProgram(companyId: string) {
  const existing = await prisma.internalProgram.findUnique({ where: { companyId } })
  if (existing) return existing
  return prisma.internalProgram.create({ data: { companyId, title: "Programa Interno de Colaboradores" } })
}

/**
 * Regras de pontuação do Programa Interno da empresa — usadas em vez de
 * constantes fixas em app/api/company/{timeclock,checklists,occurrences}.
 * Sem InternalProgram cadastrado ainda, cai nos mesmos valores-padrão que o
 * sistema sempre usou (compatibilidade com empresas que não configuraram).
 */
export async function getInternalProgramRules(companyId: string): Promise<InternalProgramRules> {
  const program = await prisma.internalProgram.findUnique({ where: { companyId } })
  if (!program) return DEFAULT_INTERNAL_PROGRAM_RULES
  return {
    pointsOnTimeCheckIn: program.pointsOnTimeCheckIn,
    pointsChecklistOnTime: program.pointsChecklistOnTime,
    pointsChecklistLateOrRejected: program.pointsChecklistLateOrRejected,
    pointsOccurrencePenalty: program.pointsOccurrencePenalty,
    minEfficiencyPercent: program.minEfficiencyPercent,
    efficiencyBonusAmount: program.efficiencyBonusAmount ? Number(program.efficiencyBonusAmount) : null,
  }
}
