import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const levels = await prisma.programLevel.findMany({ where: { programId: id }, orderBy: { order: "asc" } })
    return Response.json(levels)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id: programId } = await params

    const program = await prisma.program.findUnique({ where: { id: programId } })
    if (!program) throw new ApiError(404, "Programa não encontrado")

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
    } = body

    if (!name) throw new ApiError(400, "Nome do nível é obrigatório")

    const last = await prisma.programLevel.findFirst({ where: { programId }, orderBy: { order: "desc" } })

    const level = await prisma.programLevel.create({
      data: {
        programId,
        name,
        order: (last?.order ?? -1) + 1,
        criteria: criteria || "REFERRAL_COUNT",
        requiredReferralCount: Number(requiredReferralCount) || 0,
        requiredRevenueAmount: requiredRevenueAmount ? Number(requiredRevenueAmount) : null,
        measurementUnit: measurementUnit || "ALL_TIME",
        periodMonths: periodMonths ? Number(periodMonths) : 0,
        benefitType: benefitType || "PERCENTAGE",
        commissionPercentage: commissionPercentage ? Number(commissionPercentage) : 0,
        bonusFixedAmount: bonusFixedAmount ? Number(bonusFixedAmount) : null,
        bonusDescription: bonusDescription || null,
        badgeColorHex: badgeColorHex || "#C0C0C0",
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: program.companyId,
      action: "CREATE",
      entity: "ProgramLevel",
      entityId: level.id,
      details: body,
    })

    return Response.json(level, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
