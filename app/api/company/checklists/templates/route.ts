import type { ChecklistAssignmentType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const ASSIGNMENT_TYPES: ChecklistAssignmentType[] = ["SPECIFIC", "FREE", "SECTOR", "TAG"]

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const templates = await prisma.checklistTemplate.findMany({
      where: { companyId: user.companyId, active: true },
      include: {
        unit: { select: { id: true, name: true } },
        primaryEmployee: { select: { id: true, name: true } },
        secondaryEmployee: { select: { id: true, name: true } },
        targetSector: { select: { id: true, name: true } },
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

/** Valida assignmentType e resolve os campos de destinatário — SECTOR exige targetSectorId, TAG exige targetTag; os 3 modos != SPECIFIC zeram primary/secondaryEmployeeId. */
async function resolveAssignment(companyId: string, body: Record<string, unknown>) {
  const assignmentType = (body.assignmentType as ChecklistAssignmentType) ?? "SPECIFIC"
  if (!ASSIGNMENT_TYPES.includes(assignmentType)) throw new ApiError(400, "Tipo de destinatário inválido")

  if (assignmentType === "SPECIFIC") {
    const primaryEmployeeId = await validateEmployee(companyId, body.primaryEmployeeId as string | undefined)
    const secondaryEmployeeId = await validateEmployee(companyId, body.secondaryEmployeeId as string | undefined)
    if (secondaryEmployeeId && secondaryEmployeeId === primaryEmployeeId) {
      throw new ApiError(400, "Responsável secundário deve ser diferente do principal")
    }
    return { assignmentType, primaryEmployeeId, secondaryEmployeeId, targetSectorId: null, targetTag: null }
  }

  if (assignmentType === "SECTOR") {
    const targetSectorId = body.targetSectorId as string | undefined
    if (!targetSectorId) throw new ApiError(400, "Selecione o setor de destino")
    const sector = await prisma.sector.findFirst({ where: { id: targetSectorId, companyId } })
    if (!sector) throw new ApiError(404, "Setor não encontrado nesta empresa")
    return { assignmentType, primaryEmployeeId: null, secondaryEmployeeId: null, targetSectorId, targetTag: null }
  }

  if (assignmentType === "TAG") {
    const targetTag = typeof body.targetTag === "string" ? body.targetTag.trim() : ""
    if (!targetTag) throw new ApiError(400, "Informe a tag de destino")
    return { assignmentType, primaryEmployeeId: null, secondaryEmployeeId: null, targetSectorId: null, targetTag }
  }

  // FREE
  return { assignmentType, primaryEmployeeId: null, secondaryEmployeeId: null, targetSectorId: null, targetTag: null }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { title, description, recurrence, recurrenceDayOfWeek, recurrenceDayOfMonth, recurrenceAnchorMonth, priority, dueTime, unitId, requiresPhoto, requiresApproval } = body
    if (!title || !recurrence || !dueTime) throw new ApiError(400, "Título, recorrência e horário são obrigatórios")

    if (unitId) {
      const unit = await prisma.unit.findFirst({ where: { id: unitId, companyId } })
      if (!unit) throw new ApiError(404, "Unidade não encontrada nesta empresa")
    }

    const assignment = await resolveAssignment(companyId, body)

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
        requiresApproval: requiresApproval ?? true,
        ...assignment,
        createdById: user.id,
      },
      include: {
        unit: { select: { id: true, name: true } },
        primaryEmployee: { select: { id: true, name: true } },
        secondaryEmployee: { select: { id: true, name: true } },
        targetSector: { select: { id: true, name: true } },
        _count: { select: { instances: true } },
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "ChecklistTemplate", entityId: template.id, details: { title } })

    return Response.json(template, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
