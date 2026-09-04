import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { awardXp } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

/** Aprovar (mantém débito), reprovar (devolve XP + estoque) ou marcar como entregue. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const redemption = await prisma.rewardRedemption.findFirst({ where: { id, companyId } })
    if (!redemption) throw new ApiError(404, "Resgate não encontrado")

    const body = await request.json()
    const { status } = body as { status: "APPROVED" | "REJECTED" | "DELIVERED" }
    if (!["APPROVED", "REJECTED", "DELIVERED"].includes(status)) throw new ApiError(400, "Status inválido")
    if (redemption.status !== "PENDING" && status !== "DELIVERED") {
      throw new ApiError(400, "Resgate já foi revisado")
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === "REJECTED") {
        await awardXp(
          { companyId, employeeId: redemption.employeeId, reason: "REWARD_REDEMPTION", points: redemption.costXp, sourceId: redemption.id, note: "Resgate reprovado — XP devolvido" },
          tx,
        )
        const item = await tx.rewardCatalogItem.findUnique({ where: { id: redemption.itemId }, select: { stock: true } })
        if (item && item.stock !== null) {
          await tx.rewardCatalogItem.update({ where: { id: redemption.itemId }, data: { stock: { increment: 1 } } })
        }
      }

      return tx.rewardRedemption.update({
        where: { id },
        data: { status, reviewedById: user.id, reviewedAt: new Date() },
        include: { item: { select: { id: true, name: true } }, employee: { select: { id: true, name: true } } },
      })
    })

    await logAudit({ userId: user.id, companyId, action: status, entity: "RewardRedemption", entityId: id })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
