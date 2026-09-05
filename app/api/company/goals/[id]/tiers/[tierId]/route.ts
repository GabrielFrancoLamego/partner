import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

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
