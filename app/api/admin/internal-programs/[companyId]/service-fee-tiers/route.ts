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
      orderBy: { minPoints: "asc" },
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
    const { minPoints, maxPoints, kind, percentage, fixedAmount } = body as {
      minPoints: number
      maxPoints: number
      kind: "PERCENTAGE" | "FIXED" | "BOTH"
      percentage?: number
      fixedAmount?: number
    }

    if (minPoints === undefined || maxPoints === undefined) throw new ApiError(400, "Informe o range de pontuação (mínimo e máximo)")
    if (Number(minPoints) > Number(maxPoints)) throw new ApiError(400, "A pontuação mínima não pode ser maior que a máxima")
    if (!["PERCENTAGE", "FIXED", "BOTH"].includes(kind)) throw new ApiError(400, "Tipo de impacto financeiro inválido")
    if (kind !== "FIXED" && !percentage) throw new ApiError(400, "Informe a % da faixa")
    if (kind !== "PERCENTAGE" && !fixedAmount) throw new ApiError(400, "Informe o valor fixo (R$) da faixa")

    const program = await getOrCreateProgram(companyId)
    const tier = await prisma.internalServiceFeeTier.create({
      data: {
        internalProgramId: program.id,
        minPoints: Number(minPoints),
        maxPoints: Number(maxPoints),
        kind,
        percentage: kind !== "FIXED" ? Number(percentage) : null,
        fixedAmount: kind !== "PERCENTAGE" ? Number(fixedAmount) : null,
      },
    })

    await logAudit({ userId: admin.id, companyId, action: "CREATE", entity: "InternalServiceFeeTier", entityId: tier.id, details: body })

    return Response.json(tier, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
