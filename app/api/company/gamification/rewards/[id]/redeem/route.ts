import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { awardXp } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

/** Colaborador resgata um prêmio — XP é debitado (retido) já na solicitação; devolvido se a Gerente reprovar. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params
    const companyId = user.companyId

    const item = await prisma.rewardCatalogItem.findFirst({ where: { id, companyId, active: true } })
    if (!item) throw new ApiError(404, "Prêmio não encontrado ou indisponível")
    if (item.stock !== null && item.stock <= 0) throw new ApiError(400, "Prêmio sem estoque disponível")

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(400, "Apenas colaboradores podem resgatar prêmios")
    if (profile.xpPoints < item.costXp) throw new ApiError(400, "Saldo de XP insuficiente")

    const redemption = await prisma.$transaction(async (tx) => {
      const created = await tx.rewardRedemption.create({
        data: { companyId, itemId: id, employeeId: user.id, costXp: item.costXp, status: "PENDING" },
        include: { item: true },
      })

      await awardXp(
        { companyId, employeeId: user.id, reason: "REWARD_REDEMPTION", points: -item.costXp, sourceId: created.id },
        tx,
      )

      if (item.stock !== null) {
        await tx.rewardCatalogItem.update({ where: { id }, data: { stock: { decrement: 1 } } })
      }

      return created
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "RewardRedemption", entityId: redemption.id, details: { itemId: id } })

    return Response.json(redemption, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
