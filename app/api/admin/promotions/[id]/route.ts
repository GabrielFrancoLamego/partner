import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      validFrom,
      validUntil,
      cost,
      stock,
      active,
      bannerUrl,
      offerType,
      originalPrice,
      discountedPrice,
      discountPercentage,
    } = body

    const existing = await prisma.promotion.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Promoção não encontrada")

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId: existing.companyId })
    const promotion = await db.promotion.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(validFrom !== undefined ? { validFrom: new Date(validFrom) } : {}),
        ...(validUntil !== undefined ? { validUntil: new Date(validUntil) } : {}),
        ...(cost !== undefined ? { cost } : {}),
        ...(stock !== undefined ? { stock } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(bannerUrl !== undefined ? { bannerUrl: bannerUrl || null } : {}),
        ...(offerType !== undefined ? { offerType } : {}),
        ...(originalPrice !== undefined ? { originalPrice: originalPrice ?? null } : {}),
        ...(discountedPrice !== undefined ? { discountedPrice: discountedPrice ?? null } : {}),
        ...(discountPercentage !== undefined ? { discountPercentage: discountPercentage ?? null } : {}),
      },
    })

    return Response.json(promotion)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const existing = await prisma.promotion.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Promoção não encontrada")

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId: existing.companyId })
    await db.promotion.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
