import type { TimeEntryType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canPunchTimeclock, canManageDailyOperations } from "@/lib/permissions"
import { checkGeofence } from "@/lib/geofence"
import { awardXp, getInternalProgramRules } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

/** "HH:mm" -> minutos desde 00:00, para comparar com a hora local da batida. */
function parseTimeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

/** Sequência esperada de batidas no dia. */
const NEXT_TYPE: Record<"START" | TimeEntryType, TimeEntryType> = {
  START: "CHECK_IN",
  CHECK_IN: "BREAK_START",
  BREAK_START: "BREAK_END",
  BREAK_END: "CHECK_OUT",
  CHECK_OUT: "CHECK_IN",
}

const TYPE_LABELS: Record<TimeEntryType, string> = {
  CHECK_IN: "Entrada",
  BREAK_START: "Pausa",
  BREAK_END: "Retorno",
  CHECK_OUT: "Saída",
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** `scope=team` (Gerente/Master) traz o espelho de todos; padrão é o próprio usuário. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope")
    const employeeId = searchParams.get("employeeId")
    const days = Math.min(Number(searchParams.get("days") ?? 30), 90)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const isTeamScope = scope === "team" || !!employeeId
    if (isTeamScope) requireCapability(user, canManageDailyOperations)

    const entries = await prisma.timeEntry.findMany({
      where: {
        companyId,
        createdAt: { gte: since },
        userId: isTeamScope ? (employeeId ?? undefined) : user.id,
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return Response.json(entries)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canPunchTimeclock)
    const companyId = user.companyId

    const body = await request.json()
    const { type, latitude, longitude } = body as { type: TimeEntryType; latitude: number; longitude: number }

    if (!TYPE_LABELS[type]) throw new ApiError(400, "Tipo de batida inválido")
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new ApiError(400, "Localização (GPS) é obrigatória")
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { latitude: true, longitude: true, geofenceRadiusMeters: true },
    })
    const geofence = checkGeofence(company, latitude, longitude)
    if (!geofence.allowed) throw new ApiError(403, geofence.reason ?? "Fora do raio permitido")

    const todayEntries = await prisma.timeEntry.findMany({
      where: { companyId, userId: user.id, createdAt: { gte: startOfDay(new Date()) } },
      orderBy: { createdAt: "asc" },
    })
    const lastType = todayEntries.length > 0 ? todayEntries[todayEntries.length - 1].type : "START"
    const expected = NEXT_TYPE[lastType]
    if (type !== expected) {
      throw new ApiError(400, `Sequência inválida — a próxima batida esperada é "${TYPE_LABELS[expected]}"`)
    }

    const entry = await prisma.timeEntry.create({
      data: { userId: user.id, companyId, type, latitude, longitude },
    })

    // Banco de horas + tolerância: uma margem de `lateToleranceMinutes` (padrão
    // 15min) antes/depois do horário previsto NÃO gera hora extra nem déficit —
    // só o que exceder a tolerância entra no saldo (ver InternalProgram.lateToleranceMinutes).
    const [schedule, rules] = await Promise.all([
      prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { workStartTime: true, workEndTime: true } }),
      getInternalProgramRules(companyId),
    ])
    const tolerance = rules.lateToleranceMinutes

    let bankMinutesDelta = 0
    let lateMinutes = 0
    if (type === "CHECK_IN" && schedule?.workStartTime) {
      const diff = minutesSinceMidnight(entry.createdAt) - parseTimeToMinutes(schedule.workStartTime) // positivo = atrasado
      if (diff > tolerance) {
        lateMinutes = diff - tolerance
        bankMinutesDelta = -lateMinutes
      }
    } else if (type === "CHECK_OUT" && schedule?.workEndTime) {
      const diff = minutesSinceMidnight(entry.createdAt) - parseTimeToMinutes(schedule.workEndTime) // positivo = ficou a mais
      if (Math.abs(diff) > tolerance) {
        bankMinutesDelta = diff > 0 ? diff - tolerance : diff + tolerance
      }
    }
    if (bankMinutesDelta !== 0) {
      await prisma.employeeProfile.update({ where: { userId: user.id }, data: { bankOfHoursMinutes: { increment: bankMinutesDelta } } })
    }

    if (type === "CHECK_IN") {
      if (lateMinutes > 0) {
        if (rules.pointsLatePenalty !== 0) {
          await awardXp({
            companyId,
            employeeId: user.id,
            reason: "ATTENDANCE",
            points: rules.pointsLatePenalty,
            sourceId: entry.id,
            note: `Atraso de ${lateMinutes}min além da tolerância de ${tolerance}min`,
          })
        }
      } else {
        await awardXp({
          companyId,
          employeeId: user.id,
          reason: "ATTENDANCE",
          points: rules.pointsPunctualEntry,
          sourceId: entry.id,
          note: "Entrada pontual",
        })
      }
    }

    await logAudit({
      userId: user.id,
      companyId,
      action: "CREATE",
      entity: "TimeEntry",
      entityId: entry.id,
      details: { type, latitude, longitude, distanceMeters: geofence.distanceMeters, bankMinutesDelta, lateMinutes },
    })

    return Response.json({ ...entry, distanceMeters: geofence.distanceMeters, bankMinutesDelta, lateMinutes }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
