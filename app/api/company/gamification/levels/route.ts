import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { getOrCreateInternalProgram } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const program = await prisma.internalProgram.findUnique({ where: { companyId: user.companyId } })
    if (!program) return Response.json([])
    const levels = await prisma.internalLevelRule.findMany({ where: { internalProgramId: program.id }, orderBy: { order: "asc" } })
    return Response.json(levels)
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
      name,
      description,
      pointsRequired,
      bonusDescription,
      bonusAmount,
      badgeColorHex,
      medalIcon,
      salaryIncreasePercent,
      imageUrl,
      benefitType,
      measurementUnit,
      measurementValue,
      minTenureMonths,
    } = body
    if (!name || pointsRequired === undefined) throw new ApiError(400, "Nome e pontuação exigida são obrigatórios")

    const program = await getOrCreateInternalProgram(companyId)
    const last = await prisma.internalLevelRule.findFirst({ where: { internalProgramId: program.id }, orderBy: { order: "desc" } })

    const level = await prisma.internalLevelRule.create({
      data: {
        internalProgramId: program.id,
        name,
        description: description || null,
        order: (last?.order ?? -1) + 1,
        pointsRequired: Number(pointsRequired),
        bonusDescription: bonusDescription || null,
        bonusAmount: bonusAmount ? Number(bonusAmount) : null,
        salaryIncreasePercent: salaryIncreasePercent ? Number(salaryIncreasePercent) : null,
        imageUrl: imageUrl || null,
        badgeColorHex: badgeColorHex || "#F58220",
        medalIcon: medalIcon || "GOLD",
        benefitType: benefitType || "PERCENTAGE",
        measurementUnit: measurementUnit || "ALL_TIME",
        measurementValue: measurementValue ? Number(measurementValue) : null,
        minTenureMonths: minTenureMonths ? Number(minTenureMonths) : 0,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "InternalLevelRule", entityId: level.id, details: body })

    return Response.json(level, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
