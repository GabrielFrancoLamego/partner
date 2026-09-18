import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { getOrCreateInternalProgram } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const program = await prisma.internalProgram.findUnique({ where: { companyId: user.companyId } })
    if (!program) return Response.json([])
    const tiers = await prisma.internalServiceFeeTier.findMany({
      where: { internalProgramId: program.id },
      orderBy: [{ type: "asc" }, { thresholdPoints: "asc" }],
    })
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
    const { type, thresholdPoints, percentage, fixedAmount } = body as {
      type: "PENALTY" | "BONUS"
      thresholdPoints: number
      percentage?: number
      fixedAmount?: number
    }

    if (type !== "PENALTY" && type !== "BONUS") throw new ApiError(400, "Tipo inválido")
    if (thresholdPoints === undefined) throw new ApiError(400, "Informe a pontuação limite da faixa")
    if (!percentage && !fixedAmount) throw new ApiError(400, "Informe a % ou o valor fixo da faixa")

    const program = await getOrCreateInternalProgram(companyId)
    const tier = await prisma.internalServiceFeeTier.create({
      data: {
        internalProgramId: program.id,
        type,
        thresholdPoints: Number(thresholdPoints),
        percentage: percentage ? Number(percentage) : null,
        fixedAmount: fixedAmount ? Number(fixedAmount) : null,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "InternalServiceFeeTier", entityId: tier.id, details: body })

    return Response.json(tier, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
