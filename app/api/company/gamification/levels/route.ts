import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const levels = await prisma.careerLevel.findMany({ where: { companyId: user.companyId }, orderBy: { order: "asc" } })
    return Response.json(levels)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { name, requiredXp, bonusDescription, bonusAmount, badgeColorHex } = body
    if (!name || requiredXp === undefined) throw new ApiError(400, "Nome e XP necessário são obrigatórios")

    const last = await prisma.careerLevel.findFirst({ where: { companyId }, orderBy: { order: "desc" } })

    const level = await prisma.careerLevel.create({
      data: {
        companyId,
        name,
        order: (last?.order ?? -1) + 1,
        requiredXp: Number(requiredXp),
        bonusDescription: bonusDescription || null,
        bonusAmount: bonusAmount ? Number(bonusAmount) : null,
        badgeColorHex: badgeColorHex || "#F58220",
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "CareerLevel", entityId: level.id, details: body })

    return Response.json(level, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
