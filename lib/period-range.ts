export type Period = "today" | "week" | "month" | "year" | "all"

/** Início do período (inclusive) para filtros de dashboard. `null` = sem limite ("all"). */
export function periodStart(period: string, now = new Date()): Date | null {
  const d = new Date(now)
  switch (period) {
    case "today":
      d.setHours(0, 0, 0, 0)
      return d
    case "week":
      d.setDate(d.getDate() - 7)
      return d
    case "month":
      d.setDate(d.getDate() - 30)
      return d
    case "year":
      d.setDate(d.getDate() - 365)
      return d
    default:
      return null
  }
}

/** Início do mesmo período imediatamente anterior — usado para calcular taxa de crescimento. */
export function previousPeriodRange(period: string, now = new Date()): { start: Date; end: Date } | null {
  const currentStart = periodStart(period, now)
  if (!currentStart) return null

  const spanMs = now.getTime() - currentStart.getTime()
  return { start: new Date(currentStart.getTime() - spanMs), end: currentStart }
}

export function growthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}
