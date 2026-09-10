import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const templates = await prisma.checklistTemplate.findMany({
      where: { companyId: user.companyId, active: true },
      include: {
        unit: { select: { id: true, name: true } },
        primaryEmployee: { select: { id: true, name: true } },
        secondaryEmployee: { select: { id: true, name: true } },
        _count: { select: { instances: true } },
      },
      orderBy: { title: "asc" },
    })
    return Response.json(templates)
  } catch (error) {
    return handleApiError(error)
  }
}

async function validateEmployee(companyId: string, employeeId: string | null | undefined) {
  if (!employeeId) return null
  const employee = await prisma.user.findFirst({ where: { id: employeeId, companyId, role: "EMPLOYEE" } })
  if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
  return employeeId
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const {
      title,
      description,
      recurrence,
      recurrenceDayOfWeek,
      recurrenceDayOfMonth,
      recurrenceAnchorMonth,
      priority,
      dueTime,
      unitId,
      requiresPhoto,
      primaryEmployeeId,
      secondaryEmployeeId,
    } = body
    if (!title || !recurrence || !dueTime) throw new ApiError(400, "Título, recorrência e horário são obrigatórios")

    if (unitId) {
      const unit = await prisma.unit.findFirst({ where: { id: unitId, companyId } })
      if (!unit) throw new ApiError(404, "Unidade não encontrada nesta empresa")
    }

    await validateEmployee(companyId, primaryEmployeeId)
    await validateEmployee(companyId, secondaryEmployeeId)
    if (secondaryEmployeeId && secondaryEmployeeId === primaryEmployeeId) {
      throw new ApiError(400, "Responsável secundário deve ser diferente do principal")
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        companyId,
        unitId: unitId || null,
        title,
        description,
        recurrence,
        recurrenceDayOfWeek: recurrenceDayOfWeek ?? null,
        recurrenceDayOfMonth: recurrenceDayOfMonth ?? null,
        recurrenceAnchorMonth: recurrenceAnchorMonth ?? null,
        priority: priority ?? "MEDIUM",
        dueTime,
        requiresPhoto: requiresPhoto ?? true,
        primaryEmployeeId: primaryEmployeeId || null,
        secondaryEmployeeId: secondaryEmployeeId || null,
        createdById: user.id,
      },
      include: {
        unit: { select: { id: true, name: true } },
        primaryEmployee: { select: { id: true, name: true } },
        secondaryEmployee: { select: { id: true, name: true } },
        _count: { select: { instances: true } },
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "ChecklistTemplate", entityId: template.id, details: { title } })

    return Response.json(template, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
