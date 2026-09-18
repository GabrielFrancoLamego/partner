import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const milestones = await prisma.affiliateMilestone.findMany({
      where: { affiliateId: id },
      orderBy: { order: "asc" },
    })
    return Response.json(milestones)
  } catch (error) {
    return handleApiError(error)
  }
}

const CreateSchema = z.object({
  targetCount: z.number().int().min(1),
  bonusAmount: z.number().min(0),
})

/** Botão "+" no painel do Afiliado — cadastra um novo marco de bonificação fixa (ex: "indique 50, ganhe R$1.500"). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const parsed = CreateSchema.safeParse(await request.json())
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")

    const affiliate = await prisma.affiliate.findUnique({ where: { id } })
    if (!affiliate) throw new ApiError(404, "Afiliado não encontrado")

    const lastOrder = await prisma.affiliateMilestone.aggregate({
      where: { affiliateId: id },
      _max: { order: true },
    })

    const milestone = await prisma.affiliateMilestone.create({
      data: {
        affiliateId: id,
        order: (lastOrder._max.order ?? -1) + 1,
        targetCount: parsed.data.targetCount,
        bonusAmount: parsed.data.bonusAmount,
      },
    })

    return Response.json(milestone, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
