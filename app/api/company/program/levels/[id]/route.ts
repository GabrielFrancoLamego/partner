import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

async function findLevelInCompany(id: string, companyId: string) {
  return prisma.programLevel.findFirst({ where: { id, program: { companyId } } })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const { id } = await params

    const existing = await findLevelInCompany(id, user.companyId)
    if (!existing) throw new ApiError(404, "Nível não encontrado")

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

    const level = await prisma.programLevel.update({
      where: { id },
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

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "ProgramLevel", entityId: id, details: body })

    return Response.json(level)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const { id } = await params

    const existing = await findLevelInCompany(id, user.companyId)
    if (!existing) throw new ApiError(404, "Nível não encontrado")

    await prisma.programLevel.delete({ where: { id } })

    const remaining = await prisma.programLevel.count({ where: { programId: existing.programId } })
    if (remaining === 0) {
      await prisma.program.update({ where: { id: existing.programId }, data: { hasLevels: false } })
    }

    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "ProgramLevel", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
