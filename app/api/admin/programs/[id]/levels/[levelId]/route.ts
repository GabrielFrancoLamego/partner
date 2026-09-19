import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; levelId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id: programId, levelId } = await params

    const level = await prisma.programLevel.findFirst({ where: { id: levelId, programId }, include: { program: true } })
    if (!level) throw new ApiError(404, "Nível não encontrado")

    const body = await request.json()
    const {
      name,
      criteria,
      requiredReferralCount,
      requiredRevenueAmount,
      measurementUnit,
      periodMonths,
      benefitType,
      commissionPercentage,
      bonusFixedAmount,
      bonusDescription,
      badgeColorHex,
      medalIcon,
      imageUrl,
      order,
    } = body

    const updated = await prisma.programLevel.update({
      where: { id: levelId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(criteria !== undefined ? { criteria } : {}),
        ...(requiredReferralCount !== undefined ? { requiredReferralCount: Number(requiredReferralCount) } : {}),
        ...(requiredRevenueAmount !== undefined ? { requiredRevenueAmount: requiredRevenueAmount ? Number(requiredRevenueAmount) : null } : {}),
        ...(measurementUnit !== undefined ? { measurementUnit } : {}),
        ...(periodMonths !== undefined ? { periodMonths: Number(periodMonths) } : {}),
        ...(benefitType !== undefined ? { benefitType } : {}),
        ...(commissionPercentage !== undefined ? { commissionPercentage: Number(commissionPercentage) } : {}),
        ...(bonusFixedAmount !== undefined ? { bonusFixedAmount: bonusFixedAmount ? Number(bonusFixedAmount) : null } : {}),
        ...(bonusDescription !== undefined ? { bonusDescription: bonusDescription || null } : {}),
        ...(badgeColorHex !== undefined ? { badgeColorHex } : {}),
        ...(medalIcon !== undefined ? { medalIcon } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    })

    await logAudit({ userId: admin.id, companyId: level.program.companyId, action: "UPDATE", entity: "ProgramLevel", entityId: levelId, details: body })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; levelId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id: programId, levelId } = await params

    const level = await prisma.programLevel.findFirst({ where: { id: levelId, programId }, include: { program: true } })
    if (!level) throw new ApiError(404, "Nível não encontrado")

    await prisma.programLevel.delete({ where: { id: levelId } })
    await logAudit({
      userId: admin.id,
      companyId: level.program.companyId,
      action: "DELETE",
      entity: "ProgramLevel",
      entityId: levelId,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
