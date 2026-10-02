import type { ChecklistAssignmentType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const ASSIGNMENT_TYPES: ChecklistAssignmentType[] = ["SPECIFIC", "FREE", "SECTOR", "TAG"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.checklistTemplate.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Tarefa não encontrada")

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
      active,
      requiresPhoto,
      requiresApproval,
      assignmentType,
      primaryEmployeeId,
      secondaryEmployeeId,
      targetSectorId,
      targetTag,
    } = body

    let assignmentPatch: Record<string, unknown> = {}
    if (assignmentType !== undefined) {
      if (!ASSIGNMENT_TYPES.includes(assignmentType)) throw new ApiError(400, "Tipo de destinatário inválido")
      if (assignmentType === "SPECIFIC") {
        if (primaryEmployeeId) {
          const employee = await prisma.user.findFirst({ where: { id: primaryEmployeeId, companyId, role: "EMPLOYEE" } })
          if (!employee) throw new ApiError(404, "Colaborador principal não encontrado nesta empresa")
        }
        if (secondaryEmployeeId) {
          const employee = await prisma.user.findFirst({ where: { id: secondaryEmployeeId, companyId, role: "EMPLOYEE" } })
          if (!employee) throw new ApiError(404, "Colaborador secundário não encontrado nesta empresa")
        }
        if (secondaryEmployeeId && secondaryEmployeeId === primaryEmployeeId) {
          throw new ApiError(400, "Responsável secundário deve ser diferente do principal")
        }
        assignmentPatch = {
          assignmentType,
          primaryEmployeeId: primaryEmployeeId || null,
          secondaryEmployeeId: secondaryEmployeeId || null,
          targetSectorId: null,
          targetTag: null,
        }
      } else if (assignmentType === "SECTOR") {
        if (!targetSectorId) throw new ApiError(400, "Selecione o setor de destino")
        const sector = await prisma.sector.findFirst({ where: { id: targetSectorId, companyId } })
        if (!sector) throw new ApiError(404, "Setor não encontrado nesta empresa")
        assignmentPatch = { assignmentType, primaryEmployeeId: null, secondaryEmployeeId: null, targetSectorId, targetTag: null }
      } else if (assignmentType === "TAG") {
        const tag = typeof targetTag === "string" ? targetTag.trim() : ""
        if (!tag) throw new ApiError(400, "Informe a tag de destino")
        assignmentPatch = { assignmentType, primaryEmployeeId: null, secondaryEmployeeId: null, targetSectorId: null, targetTag: tag }
      } else {
        assignmentPatch = { assignmentType, primaryEmployeeId: null, secondaryEmployeeId: null, targetSectorId: null, targetTag: null }
      }
    } else {
      if (primaryEmployeeId !== undefined && primaryEmployeeId) {
        const employee = await prisma.user.findFirst({ where: { id: primaryEmployeeId, companyId, role: "EMPLOYEE" } })
        if (!employee) throw new ApiError(404, "Colaborador principal não encontrado nesta empresa")
      }
      if (secondaryEmployeeId !== undefined && secondaryEmployeeId) {
        const employee = await prisma.user.findFirst({ where: { id: secondaryEmployeeId, companyId, role: "EMPLOYEE" } })
        if (!employee) throw new ApiError(404, "Colaborador secundário não encontrado nesta empresa")
      }
      assignmentPatch = {
        ...(primaryEmployeeId !== undefined ? { primaryEmployeeId: primaryEmployeeId || null } : {}),
        ...(secondaryEmployeeId !== undefined ? { secondaryEmployeeId: secondaryEmployeeId || null } : {}),
      }
    }

    const template = await prisma.checklistTemplate.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
        ...(recurrenceDayOfWeek !== undefined ? { recurrenceDayOfWeek } : {}),
        ...(recurrenceDayOfMonth !== undefined ? { recurrenceDayOfMonth } : {}),
        ...(recurrenceAnchorMonth !== undefined ? { recurrenceAnchorMonth } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueTime !== undefined ? { dueTime } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(requiresPhoto !== undefined ? { requiresPhoto } : {}),
        ...(requiresApproval !== undefined ? { requiresApproval } : {}),
        ...assignmentPatch,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "ChecklistTemplate", entityId: id, details: body })

    return Response.json(template)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.checklistTemplate.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Tarefa não encontrada")

    await prisma.checklistTemplate.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "ChecklistTemplate", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
