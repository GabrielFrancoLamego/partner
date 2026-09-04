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
    const { title, description, recurrence, priority, dueTime, active } = body

    const template = await prisma.checklistTemplate.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueTime !== undefined ? { dueTime } : {}),
        ...(active !== undefined ? { active } : {}),
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
