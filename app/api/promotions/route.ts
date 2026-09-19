import { prisma } from "@/lib/prisma"
import { requireUser, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"

/** Lista promoções ativas e dentro da validade da própria empresa do operador — usado pelo Scanner PDV. */
export async function GET() {
  try {
    const user = await requireUser()
    requireCapability(user, canOperateFrontDesk)
    if (!user.companyId) throw new ApiError(400, "Usuário sem empresa vinculada")

    const now = new Date()
    const promotions = await prisma.promotion.findMany({
      where: {
        companyId: user.companyId,
        active: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        offerType: true,
        creditAmount: true,
        cost: true,
        stock: true,
        usedCount: true,
        validUntil: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const available = promotions.filter((p) => p.stock === null || p.usedCount < p.stock)

    return Response.json(available)
  } catch (error) {
    return handleApiError(error)
  }
}
