import { prisma } from "@/lib/prisma"
import { handleApiError, ApiError, requireFinanceContext } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"
import {
  checkAffiliateMilestone,
  checkAffiliateMilestones,
  payAffiliatePercentageBonus,
  payAffiliateRecurringCommission,
} from "@/lib/affiliate"

/**
 * Aprovar/reprovar/pagar uma comissão. Aprovar credita PartnerProfile.walletBalance
 * (com o WalletTransaction correspondente) — esse é o único ponto do sistema
 * que credita a carteira, então o saldo só reflete comissões já liberadas pelo
 * Financeiro. Reprovar nunca chegou a creditar, então não há estorno.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)
    const { id } = await params
    const companyId = scopeCompanyId

    const commission = await prisma.commission.findFirst({ where: { id, companyId } })
    if (!commission) throw new ApiError(404, "Comissão não encontrada")

    const body = await request.json()
    const { status, commissionValue } = body as { status: "APPROVED" | "REJECTED" | "PAID"; commissionValue?: number }
    if (!["APPROVED", "REJECTED", "PAID"].includes(status)) throw new ApiError(400, "Status inválido")
    if (status === "APPROVED" && commission.status !== "PENDING" && commission.status !== "AWAITING_VALUE") {
      throw new ApiError(400, "Comissão já foi revisada")
    }

    const finalValue = commissionValue !== undefined ? Number(commissionValue) : commission.commissionValue ? Number(commission.commissionValue) : 0

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.commission.update({
        where: { id },
        data: { status, ...(commissionValue !== undefined ? { commissionValue: finalValue } : {}) },
        include: { partner: { select: { id: true, name: true } } },
      })

      if (status === "APPROVED" && finalValue > 0) {
        await tx.partnerProfile.update({
          where: { userId: commission.partnerId },
          data: { walletBalance: { increment: finalValue } },
        })
        await tx.walletTransaction.create({
          data: {
            companyId,
            partnerId: commission.partnerId,
            type: "COMMISSION",
            amount: finalValue,
            description: `Comissão aprovada — ${commission.clientName}`,
            status: "COMPLETED",
            createdById: user.id,
          },
        })
      }

      return saved
    })

    await logAudit({ userId: user.id, companyId, action: status, entity: "Commission", entityId: id, details: { finalValue } })

    if (status === "APPROVED") {
      await checkAffiliateMilestone(commission.partnerId)
      await payAffiliatePercentageBonus(commission.partnerId, finalValue)
      await payAffiliateRecurringCommission(commission.partnerId, commission.id, finalValue)

      const partnerProfile = await prisma.partnerProfile.findUnique({
        where: { userId: commission.partnerId },
        select: { affiliateId: true },
      })
      if (partnerProfile?.affiliateId) await checkAffiliateMilestones(partnerProfile.affiliateId)

      const formattedValue = finalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      await notifyUser({
        userId: commission.partnerId,
        type: "COMMISSION_EARNED",
        title: "Comissão aprovada!",
        message: `Sua comissão de ${formattedValue} (${commission.clientName}) foi aprovada e creditada na sua carteira.`,
        linkUrl: "/partner",
      }).catch(() => {})
    }

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}