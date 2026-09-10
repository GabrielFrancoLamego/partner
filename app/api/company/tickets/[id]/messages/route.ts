import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const ticket = await prisma.ticket.findFirst({ where: { id, companyId: user.companyId, authorId: user.id } })
    if (!ticket) throw new ApiError(404, "Chamado não encontrado")

    const { message } = await request.json()
    if (!message?.trim()) throw new ApiError(400, "Mensagem obrigatória")

    await prisma.ticketMessage.create({ data: { ticketId: id, authorId: user.id, message: message.trim() } })
    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "OPEN", updatedAt: new Date() },
      include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } } },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
