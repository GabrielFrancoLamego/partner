import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string; levelId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId, levelId } = await params

    const level = await prisma.internalLevelRule.findFirst({ where: { id: levelId, internalProgram: { companyId } } })
    if (!level) throw new ApiError(404, "Nível não encontrado")

    const body = await request.json()
    const {
      name,
      description,
      pointsRequired,
      bonusDescription,
      bonusAmount,
      badgeColorHex,
      medalIcon,
      salaryIncreasePercent,
      imageUrl,
      order,
      benefitType,
      measurementUnit,
      measurementValue,
    } = body

    const updated = await prisma.internalLevelRule.update({
      where: { id: levelId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(pointsRequired !== undefined ? { pointsRequired: Number(pointsRequired) } : {}),
        ...(bonusDescription !== undefined ? { bonusDescription: bonusDescription || null } : {}),
        ...(bonusAmount !== undefined ? { bonusAmount: bonusAmount ? Number(bonusAmount) : null } : {}),
        ...(salaryIncreasePercent !== undefined ? { salaryIncreasePercent: salaryIncreasePercent ? Number(salaryIncreasePercent) : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
        ...(badgeColorHex !== undefined ? { badgeColorHex } : {}),
        ...(medalIcon !== undefined ? { medalIcon } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
        ...(benefitType !== undefined ? { benefitType } : {}),
        ...(measurementUnit !== undefined ? { measurementUnit } : {}),
        ...(measurementValue !== undefined ? { measurementValue: measurementValue ? Number(measurementValue) : null } : {}),
      },
    })

    await logAudit({ userId: admin.id, companyId, action: "UPDATE", entity: "InternalLevelRule", entityId: levelId, details: body })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ companyId: string; levelId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId, levelId } = await params

    const level = await prisma.internalLevelRule.findFirst({ where: { id: levelId, internalProgram: { companyId } } })
    if (!level) throw new ApiError(404, "Nível não encontrado")

    await prisma.internalLevelRule.delete({ where: { id: levelId } })
    await logAudit({ userId: admin.id, companyId, action: "DELETE", entity: "InternalLevelRule", entityId: levelId })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
