import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const program = await prisma.program.findUnique({ where: { companyId: user.companyId } })
    if (!program) return Response.json([])
    const levels = await prisma.programLevel.findMany({ where: { programId: program.id }, orderBy: { order: "asc" } })
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

    const program = await prisma.program.findUnique({ where: { companyId } })
    if (!program) throw new ApiError(400, "Cadastre o Programa de Parceria antes de criar níveis")

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
    } = body

    if (!name) throw new ApiError(400, "Nome do nível é obrigatório")

    const last = await prisma.programLevel.findFirst({ where: { programId: program.id }, orderBy: { order: "desc" } })

    const level = await prisma.programLevel.create({
      data: {
        programId: program.id,
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
        medalIcon: medalIcon || "GOLD",
        imageUrl: imageUrl || null,
      },
    })

    // Mantém Program.hasLevels em sincronia — usado pela UI (components/programs-content.tsx)
    // para decidir entre "Nível único" e "N níveis" sem precisar recontar a cada leitura.
    if (!program.hasLevels) {
      await prisma.program.update({ where: { id: program.id }, data: { hasLevels: true } })
    }

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "ProgramLevel", entityId: level.id, details: body })

    return Response.json(level, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
