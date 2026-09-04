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
