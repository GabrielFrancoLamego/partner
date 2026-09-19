import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

async function getOrCreateProgram(companyId: string) {
  const existing = await prisma.internalProgram.findUnique({ where: { companyId } })
  if (existing) return existing
  return prisma.internalProgram.create({ data: { companyId, title: "Programa Interno de Colaboradores" } })
}

export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    await requirePlatformAdmin()
    const { companyId } = await params
    const program = await prisma.internalProgram.findUnique({ where: { companyId } })
    if (!program) return Response.json([])
    const levels = await prisma.internalLevelRule.findMany({ where: { internalProgramId: program.id }, orderBy: { order: "asc" } })
    return Response.json(levels)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId } = await params

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
    } = body
    if (!name || pointsRequired === undefined) throw new ApiError(400, "Nome e pontuação exigida são obrigatórios")

    const program = await getOrCreateProgram(companyId)
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
      },
    })

    await logAudit({ userId: admin.id, companyId, action: "CREATE", entity: "InternalLevelRule", entityId: level.id, details: body })

    return Response.json(level, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
