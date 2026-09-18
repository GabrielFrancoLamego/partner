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
    const tiers = await prisma.internalServiceFeeTier.findMany({
      where: { internalProgramId: program.id },
      orderBy: [{ type: "asc" }, { thresholdPoints: "asc" }],
    })
    return Response.json(tiers)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId } = await params

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

    const program = await getOrCreateProgram(companyId)
    const tier = await prisma.internalServiceFeeTier.create({
      data: {
        internalProgramId: program.id,
        type,
        thresholdPoints: Number(thresholdPoints),
        percentage: percentage ? Number(percentage) : null,
        fixedAmount: fixedAmount ? Number(fixedAmount) : null,
      },
    })

    await logAudit({ userId: admin.id, companyId, action: "CREATE", entity: "InternalServiceFeeTier", entityId: tier.id, details: body })

    return Response.json(tier, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
