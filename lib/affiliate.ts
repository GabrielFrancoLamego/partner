import "server-only"
import { prisma } from "./prisma"

/**
 * Bônus pago ao Afiliado quando um parceiro que ele indicou (via
 * /join/partner?ref=CODE) é aprovado pelo Admin. Só se aplica a afiliados com
 * rewardType FIXED — pagos na hora. Afiliados PERCENTAGE recebem depois, sobre
 * a 1ª comissão aprovada do parceiro indicado (ver payAffiliatePercentageBonus).
 */
export async function payAffiliateSignupBonus(affiliateId: string, partnerProfileId: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } })
  if (!affiliate || affiliate.rewardType !== "FIXED" || Number(affiliate.bonusPerPartner) <= 0) return

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
 * Afiliados com rewardType PERCENTAGE recebem bonusPercentage% sobre a 1ª
 * comissão aprovada do parceiro indicado (em vez de um valor fixo no
 * cadastro). Idempotente: só paga se ainda não existir um AffiliatePayout
 * SIGNUP_BONUS para esse par afiliado/parceiro. Chamado no mesmo hook de
 * aprovação de comissão que checkAffiliateMilestone.
 */
export async function payAffiliatePercentageBonus(partnerUserId: string, approvedCommissionValue: number) {
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUserId },
    include: { affiliate: true },
  })

  if (!partnerProfile?.affiliateId || !partnerProfile.affiliate) return
  const affiliate = partnerProfile.affiliate
  if (affiliate.rewardType !== "PERCENTAGE" || !affiliate.bonusPercentage || Number(affiliate.bonusPercentage) <= 0) return

  const alreadyPaid = await prisma.affiliatePayout.findFirst({
    where: { affiliateId: affiliate.id, partnerId: partnerProfile.id, type: "SIGNUP_BONUS" },
  })
  if (alreadyPaid) return

  const amount = Math.round(approvedCommissionValue * (Number(affiliate.bonusPercentage) / 100) * 100) / 100
  if (amount <= 0) return

  await prisma.$transaction([
    prisma.affiliate.update({ where: { id: affiliate.id }, data: { walletBalance: { increment: amount } } }),
    prisma.affiliatePayout.create({
      data: { affiliateId: affiliate.id, partnerId: partnerProfile.id, type: "SIGNUP_BONUS", amount, status: "PENDING" },
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

/**
 * Se o usuário desativado for um Parceiro promovido a Afiliado (Affiliate.partnerProfileId),
 * desativa o Affiliate junto — o link de indicação dele para de aceitar cadastros
 * (ver resolveValidLink em lib/link-validation.ts) e as páginas públicas mostram "link expirado".
 */
export async function deactivateAffiliateForUser(userId: string) {
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { affiliateSelf: { select: { id: true, active: true } } },
  })
  if (partnerProfile?.affiliateSelf && partnerProfile.affiliateSelf.active) {
    await prisma.affiliate.update({ where: { id: partnerProfile.affiliateSelf.id }, data: { active: false } })
  }
}
