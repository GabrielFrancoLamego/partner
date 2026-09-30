import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { ensureMembership } from "@/lib/program-lifecycle"
import { requirePartnerAdesaoComplete } from "@/lib/partner-adesao"

/** Botão "Participar" em /partner/explorar — só permitido enquanto o programa está aberto a novas adesões. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    await requirePartnerAdesaoComplete(user.id)
    const { id } = await params

    const program = await prisma.program.findUnique({ where: { id }, select: { id: true, companyId: true, status: true } })
    if (!program) throw new ApiError(404, "Programa não encontrado")
    if (program.status !== "ACTIVE") throw new ApiError(400, "Este programa não está aceitando novas adesões no momento")

    const membership = await ensureMembership(user.id, program)
    return Response.json(membership, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
