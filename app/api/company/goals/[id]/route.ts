import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/** Editar/excluir meta — exclusivo do Master (ver POST em app/api/company/goals/route.ts). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.goal.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Meta não encontrada")

    const body = await request.json()
    const { name, active, endDate } = body

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
      include: { tiers: { orderBy: { order: "asc" } } },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "Goal", entityId: id, details: body })

    return Response.json(goal)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.goal.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Meta não encontrada")

    await prisma.goal.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId, action: "DELETE", entity: "Goal", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
