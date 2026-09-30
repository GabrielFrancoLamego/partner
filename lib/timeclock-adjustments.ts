import "server-only"
import type { TimeclockAdjustmentKind } from "@prisma/client"
import { prisma } from "./prisma"
import { getInternalProgramRules } from "./gamification"

/** "HH:mm" -> minutos desde 00:00. */
function parseTimeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}
function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export type PendingTimeclockAdjustment = {
  employeeId: string
  employeeName: string
  kind: TimeclockAdjustmentKind
  computedMinutes: number // negativo = déficit/atraso, positivo = crédito
  computedPoints: number // negativo = penalidade, positivo = bônus
  isNegativeForEmployee: boolean
  label: string
}

/**
 * Calcula, para um dia de uma empresa, toda variação de ponto (entrada
 * atrasada, saída antes/depois do horário, intervalo além do permitido) que
 * ainda não foi revisada pela Gerente/Master (ver TimeclockAdjustmentReview).
 * Nada aqui é aplicado — só o cálculo, para o Fechamento perguntar e o
 * endpoint de revisão aplicar (ver app/api/company/shift-closing/timeclock-adjustments).
 */
export async function computePendingTimeclockAdjustments(companyId: string, date: Date): Promise<PendingTimeclockAdjustment[]> {
  const dayStart = startOfDay(date)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const [entries, rules, reviewed] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { companyId, createdAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true } } },
    }),
    getInternalProgramRules(companyId),
    prisma.timeclockAdjustmentReview.findMany({ where: { companyId, date: dayStart }, select: { employeeId: true, kind: true } }),
  ])
  if (entries.length === 0) return []

  const reviewedSet = new Set(reviewed.map((r) => `${r.employeeId}:${r.kind}`))
  const tolerance = rules.lateToleranceMinutes

  const byUser = new Map<string, typeof entries>()
  for (const e of entries) {
    if (!byUser.has(e.userId)) byUser.set(e.userId, [])
    byUser.get(e.userId)!.push(e)
  }

  const results: PendingTimeclockAdjustment[] = []

  for (const [userId, userEntries] of byUser) {
    const employeeName = userEntries[0].user.name
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
      select: { workStartTime: true, workEndTime: true, dailyBreakAllowanceMinutes: true },
    })
    if (!profile) continue

    // --- Entrada atrasada / pontual ---
    const checkIn = userEntries.find((e) => e.type === "CHECK_IN")
    if (checkIn && profile.workStartTime && !reviewedSet.has(`${userId}:LATE_CHECKIN`)) {
      const diff = minutesSinceMidnight(checkIn.createdAt) - parseTimeToMinutes(profile.workStartTime)
      if (diff > tolerance) {
        const lateMinutes = diff - tolerance
        results.push({
          employeeId: userId,
          employeeName,
          kind: "LATE_CHECKIN",
          computedMinutes: -lateMinutes,
          computedPoints: rules.pointsLatePenalty,
          isNegativeForEmployee: true,
          label: `Chegou ${lateMinutes}min atrasado (além da tolerância de ${tolerance}min)`,
        })
      } else {
        results.push({
          employeeId: userId,
          employeeName,
          kind: "LATE_CHECKIN",
          computedMinutes: 0,
          computedPoints: rules.pointsPunctualEntry,
          isNegativeForEmployee: false,
          label: "Chegou no horário",
        })
      }
    }

    // --- Saída antes/depois do horário ---
    const checkOut = [...userEntries].reverse().find((e) => e.type === "CHECK_OUT")
    if (checkOut && profile.workEndTime && !reviewedSet.has(`${userId}:CHECKOUT_VARIANCE`)) {
      const diff = minutesSinceMidnight(checkOut.createdAt) - parseTimeToMinutes(profile.workEndTime) // positivo = ficou a mais
      if (Math.abs(diff) > tolerance) {
        const delta = diff > 0 ? diff - tolerance : diff + tolerance
        results.push({
          employeeId: userId,
          employeeName,
          kind: "CHECKOUT_VARIANCE",
          computedMinutes: delta,
          computedPoints: 0,
          isNegativeForEmployee: delta < 0,
          label: delta > 0 ? `Ficou ${delta}min a mais (hora extra)` : `Saiu ${Math.abs(delta)}min mais cedo`,
        })
      }
    }

    // --- Intervalo além do permitido (soma todas as janelas do dia) ---
    if (!reviewedSet.has(`${userId}:BREAK_OVERAGE`)) {
      const allowance = profile.dailyBreakAllowanceMinutes ?? 60
      let cumulativeUsed = 0
      let openStart: Date | null = null
      for (const e of userEntries) {
        if (e.type === "BREAK_START") openStart = e.createdAt
        else if (e.type === "BREAK_END" && openStart) {
          cumulativeUsed += (e.createdAt.getTime() - openStart.getTime()) / 60000
          openStart = null
        }
      }
      const overage = Math.round(Math.max(0, cumulativeUsed - allowance - tolerance))
      if (overage > 0) {
        results.push({
          employeeId: userId,
          employeeName,
          kind: "BREAK_OVERAGE",
          computedMinutes: -overage,
          computedPoints: 0,
          isNegativeForEmployee: true,
          label: `Intervalo ${overage}min além do permitido (considerando a tolerância de ${tolerance}min)`,
        })
      }
    }
  }

  return results
}
