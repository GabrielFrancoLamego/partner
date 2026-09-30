import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; tierId: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id: goalId, tierId } = await params
    const companyId = user.companyId

    const tier = await prisma.goalTier.findFirst({ where: { id: tierId, goalId, goal: { companyId } } })
    if (!tier) throw new ApiError(404, "Faixa não encontrada")

    const body = await request.json()
    const { targetAmount, bonusAmount, rewardType, rewardCatalogItemId, rewardLabel } = body

    if (rewardCatalogItemId) {
      const item = await prisma.rewardCatalogItem.findFirst({ where: { id: rewardCatalogItemId, companyId } })
      if (!item) throw new ApiError(404, "Item da Loja de Prêmios não encontrado")
    }

    const updated = await prisma.goalTier.update({
      where: { id: tierId },
      data: {
        ...(targetAmount !== undefined ? { targetAmount: Number(targetAmount) } : {}),
        ...(bonusAmount !== undefined ? { bonusAmount: Number(bonusAmount) } : {}),
        ...(rewardType !== undefined ? { rewardType: rewardType === "PHYSICAL_REWARD" ? "PHYSICAL_REWARD" : "CASH" } : {}),
        ...(rewardCatalogItemId !== undefined ? { rewardCatalogItemId: rewardCatalogItemId || null } : {}),
        ...(rewardLabel !== undefined ? { rewardLabel: rewardLabel || null } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "GoalTier", entityId: tierId, details: body })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; tierId: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id: goalId, tierId } = await params
    const companyId = user.companyId

    const tier = await prisma.goalTier.findFirst({ where: { id: tierId, goalId, goal: { companyId } } })
    if (!tier) throw new ApiError(404, "Faixa não encontrada")

    await prisma.goalTier.delete({ where: { id: tierId } })
    await logAudit({ userId: user.id, companyId, action: "DELETE", entity: "GoalTier", entityId: tierId })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
