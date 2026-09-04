import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.rewardCatalogItem.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Prêmio não encontrado")

    const body = await request.json()
    const { name, description, costXp, stock, active } = body

    const reward = await prisma.rewardCatalogItem.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(costXp !== undefined ? { costXp: Number(costXp) } : {}),
        ...(stock !== undefined ? { stock: stock === null || stock === "" ? null : Number(stock) } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "RewardCatalogItem", entityId: id, details: body })

    return Response.json(reward)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.rewardCatalogItem.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Prêmio não encontrado")

    await prisma.rewardCatalogItem.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "RewardCatalogItem", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
