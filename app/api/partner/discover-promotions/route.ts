import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"

/**
 * "Descobrir Promo" — vitrine aberta de promoções de TODAS as empresas
 * cadastradas (com Programa de Parceria não arquivado), com busca/filtros
 * combinados e o programId de cada uma para o botão "Aderir ao Programa"
 * (ver /api/partner/programs/[id]/join).
 */
export async function GET(request: Request) {
  try {
    const user = await requirePartner()
    const now = new Date()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim().toLowerCase() ?? ""
    const city = searchParams.get("city")
    const offerType = searchParams.get("offerType")

    const promotions = await prisma.promotion.findMany({
      where: {
        active: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
        ...(offerType ? { offerType: offerType as "DISCOUNT" | "FREE_GIFT" | "DOUBLE_BENEFIT" | "CASH_CREDIT" } : {}),
        company: {
          programs: { some: { status: { not: "ARCHIVED" } } },
          ...(city ? { city } : {}),
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            city: true,
            segment: true,
            avgRating: true,
            ratingCount: true,
            profilePictureUrl: true,
            programs: { where: { status: { not: "ARCHIVED" } }, select: { id: true, status: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const available = promotions.filter((p) => p.stock === null || p.usedCount < p.stock)

    const filtered = q
      ? available.filter((p) => {
          const haystack = `${p.company.name} ${p.company.segment ?? ""} ${p.title}`.toLowerCase()
          return haystack.includes(q)
        })
      : available

    if (filtered.length === 0) return Response.json([])

    const companyIds = Array.from(new Set(filtered.map((p) => p.companyId)))
    const memberships = await prisma.programMembership.findMany({
      where: { partnerId: user.id, companyId: { in: companyIds } },
      select: { companyId: true, status: true },
    })
    const membershipByCompany = new Map(memberships.map((m) => [m.companyId, m.status]))

    const result = filtered.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      bannerUrl: p.bannerUrl,
      offerType: p.offerType,
      originalPrice: p.originalPrice,
      discountedPrice: p.discountedPrice,
      discountPercentage: p.discountPercentage,
      creditAmount: p.creditAmount,
      company: {
        id: p.company.id,
        name: p.company.name,
        city: p.company.city,
        segment: p.company.segment,
        avgRating: p.company.avgRating,
        ratingCount: p.company.ratingCount,
        profilePictureUrl: p.company.profilePictureUrl,
      },
      programId: p.company.programs[0]?.id ?? null,
      programStatus: p.company.programs[0]?.status ?? null,
      membershipStatus: membershipByCompany.get(p.companyId) ?? null,
    }))

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
