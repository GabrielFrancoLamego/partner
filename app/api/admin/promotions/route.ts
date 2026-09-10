import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const promotions = await prisma.promotion.findMany({
      where: companyId && companyId !== "all" ? { companyId } : {},
      include: {
        company: { select: { id: true, name: true } },
        units: { include: { unit: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(promotions)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const {
      companyId,
      title,
      description,
      validFrom,
      validUntil,
      cost,
      stock,
      unitIds,
      bannerUrl,
      offerType,
      originalPrice,
      discountedPrice,
      discountPercentage,
    } = body

    if (!companyId || !title || !validFrom || !validUntil || cost === undefined) {
      throw new ApiError(400, "Empresa, título, período e custo são obrigatórios")
    }

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId })
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
        originalPrice: originalPrice ?? null,
        discountedPrice: discountedPrice ?? null,
        discountPercentage: discountPercentage ?? null,
        units: unitIds?.length ? { create: unitIds.map((unitId: string) => ({ unitId })) } : undefined,
      },
    })

    return Response.json(promotion, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
