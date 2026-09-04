import type { OccurrenceType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { awardXp } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

const WARNING_XP_PENALTY = -10

const OCCURRENCE_TYPES: OccurrenceType[] = [
  "WARNING",
  "SALARY_ADVANCE",
  "CASH_SHORTAGE",
  "SUSPENSION",
  "DAY_OFF",
  "HOLIDAY_PAY",
  "SUNDAY_WORKED_PAY",
  "SUNDAY_DAY_OFF",
]

/** Painel exclusivo da Gerente/Master — filtro por mês (YYYY-MM) e colaborador. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") // "2026-09"
    const employeeId = searchParams.get("employeeId")

    let dateWhere: { gte: Date; lt: Date } | undefined
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number)
      dateWhere = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
    }

    const occurrences = await prisma.occurrence.findMany({
      where: {
        companyId,
        ...(dateWhere ? { date: dateWhere } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    })

    return Response.json(occurrences)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const formData = await request.formData()
    const employeeId = formData.get("employeeId")
    const type = formData.get("type")
    const dateRaw = formData.get("date")
    const amount = formData.get("amount")
    const description = formData.get("description")
    const file = formData.get("file")

    if (typeof employeeId !== "string" || !employeeId) throw new ApiError(400, "Colaborador é obrigatório")
    if (typeof type !== "string" || !OCCURRENCE_TYPES.includes(type as OccurrenceType)) {
      throw new ApiError(400, "Tipo de ocorrência inválido")
    }

    const employee = await prisma.user.findFirst({ where: { id: employeeId, companyId } })
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    let documentUrl: string | null = null
    if (type === "WARNING") {
      if (!(file instanceof File) || file.size === 0) {
        throw new ApiError(400, "Foto do documento assinado é obrigatória para Advertência")
      }
      documentUrl = await uploadImage("occurrences", file)
    } else if (file instanceof File && file.size > 0) {
      documentUrl = await uploadImage("occurrences", file)
    }

    const date = typeof dateRaw === "string" && dateRaw ? new Date(dateRaw) : new Date()

    const occurrence = await prisma.occurrence.create({
      data: {
        companyId,
        employeeId,
        type: type as OccurrenceType,
        date,
        amount: typeof amount === "string" && amount ? Number(amount) : null,
        description: typeof description === "string" && description ? description.trim() : null,
        documentUrl,
        createdById: user.id,
      },
      include: { employee: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    })

    if (type === "WARNING") {
      await awardXp({
        companyId,
        employeeId,
        reason: "OCCURRENCE_PENALTY",
        points: WARNING_XP_PENALTY,
        sourceId: occurrence.id,
        note: "Advertência registrada",
      })
    }

    await logAudit({
      userId: user.id,
      companyId,
      action: "CREATE",
      entity: "Occurrence",
      entityId: occurrence.id,
      details: { employeeId, type },
    })

    return Response.json(occurrence, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
