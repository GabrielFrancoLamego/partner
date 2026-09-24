import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

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

const ALERT_WINDOW_MINUTES = 10

/**
 * Colaboradores atualmente "em turno" (última batida do dia é CHECK_IN ou
 * BREAK_END, sem CHECK_OUT ainda) a até ALERT_WINDOW_MINUTES de estourar o
 * horário previsto (EmployeeProfile.workEndTime) — ou já em hora extra.
 * Polling do dashboard da Gerente/Master (ver /company/ponto).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId
    const now = new Date()
    const today = startOfDay(now)

    const employees = await prisma.employeeProfile.findMany({
      where: { user: { companyId, role: "EMPLOYEE", status: "ACTIVE" }, workEndTime: { not: null } },
      select: { userId: true, workEndTime: true, user: { select: { name: true } } },
    })
    if (employees.length === 0) return Response.json([])

    const todayEntries = await prisma.timeEntry.findMany({
      where: { companyId, userId: { in: employees.map((e) => e.userId) }, createdAt: { gte: today } },
      orderBy: { createdAt: "asc" },
      select: { userId: true, type: true },
    })
    const lastTypeByUser = new Map<string, string>()
    for (const e of todayEntries) lastTypeByUser.set(e.userId, e.type)

    const nowMinutes = minutesSinceMidnight(now)
    const alerts = employees
      .filter((e) => {
        const lastType = lastTypeByUser.get(e.userId)
        return lastType === "CHECK_IN" || lastType === "BREAK_END"
      })
      .map((e) => {
        const endMinutes = parseTimeToMinutes(e.workEndTime!)
        const minutesToEnd = endMinutes - nowMinutes
        return { employeeId: e.userId, name: e.user.name, workEndTime: e.workEndTime, minutesToEnd }
      })
      .filter((a) => a.minutesToEnd <= ALERT_WINDOW_MINUTES)
      .map((a) => ({ ...a, status: a.minutesToEnd <= 0 ? "overtime" : "approaching" }))

    return Response.json(alerts)
  } catch (error) {
    return handleApiError(error)
  }
}
