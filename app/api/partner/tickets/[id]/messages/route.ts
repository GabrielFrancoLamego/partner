import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { notifyCompanyManagement } from "@/lib/notifications"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    const { id } = await params

    const ticket = await prisma.ticket.findFirst({ where: { id, authorId: user.id } })
    if (!ticket) throw new ApiError(404, "Chamado não encontrado")

    const { message } = await request.json()
    if (!message?.trim()) throw new ApiError(400, "Mensagem obrigatória")

    await prisma.ticketMessage.create({ data: { ticketId: id, authorId: user.id, message: message.trim() } })
    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "OPEN", updatedAt: new Date() },
      include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } } },
    })

    if (ticket.companyId) {
      await notifyCompanyManagement(ticket.companyId, {
        type: "TICKET_MESSAGE_RECEIVED",
        title: `Nova mensagem de ${user.name}`,
        message: `"${ticket.subject}" — ${message.trim().slice(0, 120)}`,
        linkUrl: "/company/comunicacao?tab=parceiros",
      }).catch(() => {})
    }

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
