import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"

/** Promoções ativas de qualquer empresa — o parceiro não pertence a uma empresa fixa. */
export async function GET() {
  try {
    await requirePartner()
    const now = new Date()

    const promotions = await prisma.promotion.findMany({
      where: { active: true, validFrom: { lte: now }, validUntil: { gte: now } },
      include: { company: { select: { id: true, name: true, profilePictureUrl: true } } },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(promotions.filter((p) => p.stock === null || p.usedCount < p.stock))
  } catch (error) {
    return handleApiError(error)
  }
}
