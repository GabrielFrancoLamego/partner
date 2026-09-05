import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.revenueGoalTier.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Meta não encontrada")

    const body = await request.json()
    const { targetAmount, bonusAmount, order } = body

    const tier = await prisma.revenueGoalTier.update({
      where: { id },
      data: {
        ...(targetAmount !== undefined ? { targetAmount: Number(targetAmount) } : {}),
        ...(bonusAmount !== undefined ? { bonusAmount: Number(bonusAmount) } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "RevenueGoalTier", entityId: id, details: body })

    return Response.json(tier)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.revenueGoalTier.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Meta não encontrada")

    await prisma.revenueGoalTier.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "RevenueGoalTier", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
