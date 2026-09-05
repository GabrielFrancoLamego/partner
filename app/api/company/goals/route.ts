import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const tiers = await prisma.revenueGoalTier.findMany({ where: { companyId: user.companyId }, orderBy: { order: "asc" } })
    return Response.json(tiers)
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
    const { targetAmount, bonusAmount } = body
    if (targetAmount === undefined || bonusAmount === undefined) {
      throw new ApiError(400, "Meta de faturamento e bônus são obrigatórios")
    }

    const last = await prisma.revenueGoalTier.findFirst({ where: { companyId }, orderBy: { order: "desc" } })

    const tier = await prisma.revenueGoalTier.create({
      data: { companyId, order: (last?.order ?? -1) + 1, targetAmount: Number(targetAmount), bonusAmount: Number(bonusAmount) },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "RevenueGoalTier", entityId: tier.id, details: body })

    return Response.json(tier, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
