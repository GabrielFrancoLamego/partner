import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

async function findLevelInCompany(id: string, companyId: string) {
  return prisma.internalLevelRule.findFirst({ where: { id, internalProgram: { companyId } } })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await findLevelInCompany(id, user.companyId)
    if (!existing) throw new ApiError(404, "Nível não encontrado")

    const body = await request.json()
    const { name, pointsRequired, bonusDescription, bonusAmount, badgeColorHex, salaryIncreasePercent, imageUrl, order } = body

    const level = await prisma.internalLevelRule.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(pointsRequired !== undefined ? { pointsRequired: Number(pointsRequired) } : {}),
        ...(bonusDescription !== undefined ? { bonusDescription: bonusDescription || null } : {}),
        ...(bonusAmount !== undefined ? { bonusAmount: bonusAmount ? Number(bonusAmount) : null } : {}),
        ...(salaryIncreasePercent !== undefined ? { salaryIncreasePercent: salaryIncreasePercent ? Number(salaryIncreasePercent) : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
        ...(badgeColorHex !== undefined ? { badgeColorHex } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "InternalLevelRule", entityId: id, details: body })

    return Response.json(level)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await findLevelInCompany(id, user.companyId)
    if (!existing) throw new ApiError(404, "Nível não encontrado")

    await prisma.internalLevelRule.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "InternalLevelRule", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
