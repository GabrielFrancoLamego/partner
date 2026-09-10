import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.checklistTemplate.findFirst({ where: { id, companyId: user.companyId } })
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
      primaryEmployeeId,
      secondaryEmployeeId,
    } = body

    if (primaryEmployeeId !== undefined && primaryEmployeeId) {
      const employee = await prisma.user.findFirst({ where: { id: primaryEmployeeId, companyId: user.companyId, role: "EMPLOYEE" } })
      if (!employee) throw new ApiError(404, "Colaborador principal não encontrado nesta empresa")
    }
    if (secondaryEmployeeId !== undefined && secondaryEmployeeId) {
      const employee = await prisma.user.findFirst({ where: { id: secondaryEmployeeId, companyId: user.companyId, role: "EMPLOYEE" } })
      if (!employee) throw new ApiError(404, "Colaborador secundário não encontrado nesta empresa")
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
        ...(primaryEmployeeId !== undefined ? { primaryEmployeeId: primaryEmployeeId || null } : {}),
        ...(secondaryEmployeeId !== undefined ? { secondaryEmployeeId: secondaryEmployeeId || null } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "ChecklistTemplate", entityId: id, details: body })

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
