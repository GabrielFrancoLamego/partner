import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { auditedClient } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const promotions = await prisma.promotion.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    })
    return Response.json(promotions)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const companyId = user.companyId

    const body = await request.json()
    const {
      title,
      description,
      validFrom,
      validUntil,
      cost,
      stock,
      bannerUrl,
      offerType,
      originalPrice,
      discountedPrice,
      discountPercentage,
      creditAmount,
      audience,
    } = body

    if (!title || !validFrom || !validUntil || cost === undefined) {
      throw new ApiError(400, "Título, período e custo são obrigatórios")
    }
    if (offerType === "CASH_CREDIT" && !creditAmount) {
      throw new ApiError(400, "Informe o valor do crédito na comanda")
    }

    const db = auditedClient({ userId: user.id, role: user.role, companyId })
    const promotion = await db.promotion.create({
      data: {
        companyId,
        title,
        description: description ?? "",
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        cost,
        stock: stock ?? null,
        bannerUrl: bannerUrl || null,
        offerType: offerType ?? "DISCOUNT",
        audience: audience === "INTERNAL" ? "INTERNAL" : "EXTERNAL",
        originalPrice: originalPrice ?? null,
        discountedPrice: discountedPrice ?? null,
        discountPercentage: discountPercentage ?? null,
        creditAmount: creditAmount ?? null,
      },
    })

    return Response.json(promotion, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
