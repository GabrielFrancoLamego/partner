import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { countAffiliateConversions, countConvertedCompanies } from "@/lib/affiliate"

/**
 * Painel do Afiliado (/partner/afiliado) — só existe para parceiros
 * promovidos a Afiliado Especial (ver Affiliate.partnerProfileId, painel de
 * Afiliados do Admin). Reúne link de convite, métricas de acesso/conversão
 * (Lead vs Convertido — ver countAffiliateConversions), comissões
 * acumuladas e progresso dos milestones multi-nível.
 */
export async function GET() {
  try {
    const user = await requirePartner()

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!partnerProfile) throw new ApiError(404, "Perfil de parceiro não encontrado")

    const affiliate = await prisma.affiliate.findUnique({
      where: { partnerProfileId: partnerProfile.id },
      include: {
        milestones: { orderBy: { order: "asc" } },
        partners: {
          select: {
            id: true,
            fullName: true,
            user: {
              select: {
                name: true,
                email: true,
                createdAt: true,
                _count: { select: { commissionsAsPartner: true } },
              },
            },
          },
        },
        payouts: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    })

    if (!affiliate) {
      return Response.json({ isAffiliate: false })
    }

    const [visitCounts, leadPartnersCount, convertedPartnersCount, referredCompanies, convertedCompaniesCount] =
      await Promise.all([
        prisma.affiliateLinkVisit.groupBy({ by: ["target"], where: { affiliateId: affiliate.id }, _count: true }),
        prisma.partnerProfile.count({
          where: { affiliateId: affiliate.id, user: { commissionsAsPartner: { none: { status: { in: ["APPROVED", "PAID"] } } } } },
        }),
        prisma.partnerProfile.count({
          where: { affiliateId: affiliate.id, user: { commissionsAsPartner: { some: { status: { in: ["APPROVED", "PAID"] } } } } },
        }),
        prisma.company.findMany({ where: { affiliateId: affiliate.id }, select: { id: true, name: true, license: { select: { isExempt: true, status: true } } } }),
        countConvertedCompanies(affiliate.id),
      ])

    const totalConverted = await countAffiliateConversions(affiliate.id)

    const totalPaid = affiliate.payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0)
    const totalPending = affiliate.payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + Number(p.amount), 0)

    return Response.json({
      isAffiliate: true,
      code: affiliate.code,
      partnerLink: `/join/partner?ref=${affiliate.code}`,
      companyLink: `/join/company?ref=${affiliate.code}`,
      rewardType: affiliate.rewardType,
      bonusPerPartner: Number(affiliate.bonusPerPartner),
      bonusPercentage: affiliate.bonusPercentage ? Number(affiliate.bonusPercentage) : null,
      recurringPercentage: affiliate.recurringPercentage ? Number(affiliate.recurringPercentage) : null,
      walletBalance: Number(affiliate.walletBalance),
      totalPaid,
      totalPending,
      metrics: {
        partnerLinkVisits: visitCounts.find((v) => v.target === "PARTNER")?._count ?? 0,
        companyLinkVisits: visitCounts.find((v) => v.target === "COMPANY")?._count ?? 0,
        leadPartners: leadPartnersCount,
        convertedPartners: convertedPartnersCount,
        referredCompanies: referredCompanies.length,
        convertedCompanies: convertedCompaniesCount,
        totalConverted,
      },
      network: affiliate.partners.map((p) => ({
        id: p.id,
        name: p.fullName || p.user.name,
        email: p.user.email,
        joinedAt: p.user.createdAt,
        commissionsCount: p.user._count.commissionsAsPartner,
      })),
      referredCompanies: referredCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        converted: Boolean(c.license && !c.license.isExempt && c.license.status === "ACTIVE"),
      })),
      milestones: affiliate.milestones.map((m) => ({
        id: m.id,
        targetCount: m.targetCount,
        bonusAmount: Number(m.bonusAmount),
        achievedAt: m.achievedAt,
        progress: Math.min(100, Math.round((totalConverted / m.targetCount) * 100)),
      })),
      recentPayouts: affiliate.payouts.map((p) => ({
        id: p.id,
        type: p.type,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
