import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.careerLevel.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Nível não encontrado")

    const body = await request.json()
    const { name, requiredXp, bonusDescription, bonusAmount, badgeColorHex, order } = body

    const level = await prisma.careerLevel.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(requiredXp !== undefined ? { requiredXp: Number(requiredXp) } : {}),
        ...(bonusDescription !== undefined ? { bonusDescription: bonusDescription || null } : {}),
        ...(bonusAmount !== undefined ? { bonusAmount: bonusAmount ? Number(bonusAmount) : null } : {}),
        ...(badgeColorHex !== undefined ? { badgeColorHex } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "CareerLevel", entityId: id, details: body })

    return Response.json(level)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.careerLevel.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Nível não encontrado")

    await prisma.careerLevel.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "CareerLevel", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
