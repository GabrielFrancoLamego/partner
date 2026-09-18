import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"

/** Detalhe de um Program para o parceiro — inclui histórico de mudanças de regras (ver task "Ver Histórico"). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    const { id } = await params

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, city: true, segment: true, avgRating: true, ratingCount: true } },
        changeLog: { orderBy: { createdAt: "desc" }, take: 20, include: { changedBy: { select: { name: true } } } },
        memberships: { where: { partnerId: user.id }, take: 1 },
      },
    })
    if (!program) throw new ApiError(404, "Programa não encontrado")

    const { memberships, ...programFields } = program
    return Response.json({ ...programFields, membership: memberships[0] ?? null })
  } catch (error) {
    return handleApiError(error)
  }
}
