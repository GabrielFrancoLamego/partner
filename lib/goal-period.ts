import type { GoalPeriod } from "@prisma/client"

/** Janela [start, end) do período corrente de uma meta — usada para consolidar a soma dos GoalRecord diários. */
export function currentPeriodWindow(period: GoalPeriod, now = new Date()): { start: Date; end: Date } {
  const y = now.getFullYear()
  switch (period) {
    case "DAILY": {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
    }
    case "MONTHLY":
      return { start: new Date(y, now.getMonth(), 1), end: new Date(y, now.getMonth() + 1, 1) }
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3)
      return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1) }
    }
    case "SEMIANNUAL": {
      const half = now.getMonth() < 6 ? 0 : 6
      return { start: new Date(y, half, 1), end: new Date(y, half + 6, 1) }
    }
    case "ANNUAL":
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
  }
}

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  DAILY: "Diária",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
}
