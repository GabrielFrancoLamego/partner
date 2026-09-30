import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id: goalId } = await params
    const companyId = user.companyId

    const goal = await prisma.goal.findFirst({ where: { id: goalId, companyId } })
    if (!goal) throw new ApiError(404, "Meta não encontrada")

    const body = await request.json()
    const { targetAmount, bonusAmount, rewardType, rewardCatalogItemId, rewardLabel } = body
    if (targetAmount === undefined || bonusAmount === undefined) throw new ApiError(400, "Valor da meta e bônus são obrigatórios")

    if (rewardCatalogItemId) {
      const item = await prisma.rewardCatalogItem.findFirst({ where: { id: rewardCatalogItemId, companyId } })
      if (!item) throw new ApiError(404, "Item da Loja de Prêmios não encontrado")
    }

    const last = await prisma.goalTier.findFirst({ where: { goalId }, orderBy: { order: "desc" } })
    const tier = await prisma.goalTier.create({
      data: {
        goalId,
        order: (last?.order ?? -1) + 1,
        targetAmount: Number(targetAmount),
        bonusAmount: Number(bonusAmount),
        rewardType: rewardType === "PHYSICAL_REWARD" ? "PHYSICAL_REWARD" : "CASH",
        rewardCatalogItemId: rewardCatalogItemId || null,
        rewardLabel: rewardLabel || null,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "GoalTier", entityId: tier.id, details: body })

    return Response.json(tier, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
