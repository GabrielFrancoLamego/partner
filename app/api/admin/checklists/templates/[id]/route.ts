import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { title, description, recurrence, priority, dueTime, active, unitId } = body

    const existing = await prisma.checklistTemplate.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Template não encontrado")

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId: existing.companyId })
    const template = await db.checklistTemplate.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueTime !== undefined ? { dueTime } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(unitId !== undefined ? { unitId: unitId || null } : {}),
      },
    })

    return Response.json(template)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const existing = await prisma.checklistTemplate.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Template não encontrado")

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId: existing.companyId })
    await db.checklistTemplate.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
