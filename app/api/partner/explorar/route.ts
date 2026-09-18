import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"
import { sweepInactiveMemberships, sweepPauseExpirations } from "@/lib/program-lifecycle"

/**
 * Busca inteligente de Programas Externos (de Parceiros) — o parceiro não
 * pertence a uma empresa fixa, então esta é a lista de TODAS as empresas com
 * Program não arquivado. Filtros combinados: texto livre (nome/segmento),
 * cidade, comissão mínima e nota mínima (ver Company.avgRating).
 */
export async function GET(request: Request) {
  try {
    const user = await requirePartner()
    await sweepPauseExpirations()
    await sweepInactiveMemberships()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim().toLowerCase() ?? ""
    const city = searchParams.get("city")
    const minCommission = searchParams.get("minCommission")
    const minRating = searchParams.get("minRating")

    const programs = await prisma.program.findMany({
      where: {
        status: { not: "ARCHIVED" },
        ...(city ? { company: { city } } : {}),
      },
      include: {
        company: {
          select: { id: true, name: true, city: true, segment: true, avgRating: true, ratingCount: true, profilePictureUrl: true },
        },
        memberships: { where: { partnerId: user.id }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    })

    const filtered = programs.filter((p) => {
      if (q) {
        const haystack = `${p.company.name} ${p.company.segment ?? ""} ${p.name} ${p.description}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (minCommission) {
        const min = Number(minCommission)
        const value = Number(p.commissionValue)
        const extra = p.fixedValue ? Number(p.fixedValue) : 0
        if (value + extra < min) return false
      }
      if (minRating) {
        const min = Number(minRating)
        if (!p.company.avgRating || Number(p.company.avgRating) < min) return false
      }
      return true
    })

    const result = filtered.map((p) => {
      const membership = p.memberships[0] ?? null
      return {
        programId: p.id,
        companyId: p.companyId,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        pdfUrl: p.pdfUrl,
        videoUrl: p.videoUrl,
        commissionType: p.commissionType,
        commissionValue: p.commissionValue,
        commissionFormat: p.commissionFormat,
        fixedValue: p.fixedValue,
        productUnitLabel: p.productUnitLabel,
        status: p.status,
        pauseEffectiveAt: p.pauseEffectiveAt,
        company: {
          id: p.company.id,
          name: p.company.name,
          city: p.company.city,
          segment: p.company.segment,
          avgRating: p.company.avgRating,
          ratingCount: p.company.ratingCount,
          profilePictureUrl: p.company.profilePictureUrl,
        },
        membership: membership
          ? {
              status: membership.status,
              joinedAt: membership.joinedAt,
              lastActivityAt: membership.lastActivityAt,
              lastChangeAckAt: membership.lastChangeAckAt,
              forfeitedBalance: membership.forfeitedBalance,
            }
          : null,
      }
    })

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
