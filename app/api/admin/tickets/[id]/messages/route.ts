import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const { message } = await request.json()

    if (!message?.trim()) throw new ApiError(400, "Mensagem não pode ser vazia")

    const ticket = await prisma.ticket.findUnique({ where: { id } })
    if (!ticket) throw new ApiError(404, "Chamado não encontrado")

    const [reply] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: { ticketId: id, authorId: admin.id, message },
      }),
      prisma.ticket.update({ where: { id }, data: { status: "ANSWERED" } }),
    ])

    return Response.json(reply, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
