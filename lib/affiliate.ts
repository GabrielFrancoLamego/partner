import "server-only"
import { prisma } from "./prisma"

/**
 * Bônus pago ao Afiliado quando um parceiro que ele indicou (via
 * /join/partner?ref=CODE) é aprovado pelo Admin. Chamado uma única vez, no
 * momento da aprovação do PublicRegistrationRequest — nunca reprocessado.
 */
export async function payAffiliateSignupBonus(affiliateId: string, partnerProfileId: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } })
  if (!affiliate || Number(affiliate.bonusPerPartner) <= 0) return

  await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: affiliateId },
      data: { walletBalance: { increment: affiliate.bonusPerPartner } },
    }),
    prisma.affiliatePayout.create({
      data: {
        affiliateId,
        partnerId: partnerProfileId,
        type: "SIGNUP_BONUS",
        amount: affiliate.bonusPerPartner,
        status: "PENDING",
      },
    }),
  ])
}

/**
 * Verifica se o parceiro indicado por um Afiliado já bateu a meta de
 * "primeiros N clientes convertidos" (comissões aprovadas) e, se sim, paga o
 * bônus de milestone uma única vez (guarda de idempotência: `affiliateMilestoneAt`).
 * Chamado a cada aprovação de comissão (app/api/company/finance/commissions/[id]).
 */
export async function checkAffiliateMilestone(partnerUserId: string) {
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUserId },
    include: { affiliate: true },
  })

  if (!partnerProfile?.affiliateId || !partnerProfile.affiliate || partnerProfile.affiliateMilestoneAt) return
  if (Number(partnerProfile.affiliate.milestoneBonus) <= 0) return

  const convertedClients = await prisma.commission.count({
    where: { partnerId: partnerUserId, status: { in: ["APPROVED", "PAID"] } },
  })

  if (convertedClients < partnerProfile.affiliate.milestoneClientCount) return

  await prisma.$transaction([
    prisma.partnerProfile.update({ where: { userId: partnerUserId }, data: { affiliateMilestoneAt: new Date() } }),
    prisma.affiliate.update({
      where: { id: partnerProfile.affiliateId },
      data: { walletBalance: { increment: partnerProfile.affiliate.milestoneBonus } },
    }),
    prisma.affiliatePayout.create({
      data: {
        affiliateId: partnerProfile.affiliateId,
        partnerId: partnerProfile.id,
        type: "MILESTONE_BONUS",
        amount: partnerProfile.affiliate.milestoneBonus,
        status: "PENDING",
      },
    }),
  ])
}
