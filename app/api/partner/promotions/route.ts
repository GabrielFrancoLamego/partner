import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"

/**
 * "Minhas Promoções" — promoções ativas SÓ das empresas cujo Programa de
 * Parceria o parceiro já aderiu (ProgramMembership ACTIVE). Para a vitrine
 * aberta de TODAS as empresas, ver /api/partner/discover-promotions
 * (/partner/promocoes?tab=descobrir).
 */
export async function GET() {
  try {
    const user = await requirePartner()
    const now = new Date()

    const memberships = await prisma.programMembership.findMany({
      where: { partnerId: user.id, status: "ACTIVE" },
      select: { companyId: true },
    })
    const companyIds = memberships.map((m) => m.companyId)
    if (companyIds.length === 0) return Response.json([])

    const promotions = await prisma.promotion.findMany({
      where: { companyId: { in: companyIds }, active: true, audience: "EXTERNAL", validFrom: { lte: now }, validUntil: { gte: now } },
      include: { company: { select: { id: true, name: true, profilePictureUrl: true } } },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(promotions.filter((p) => p.stock === null || p.usedCount < p.stock))
  } catch (error) {
    return handleApiError(error)
  }
}
