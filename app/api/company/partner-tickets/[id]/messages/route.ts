import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { notifyUser } from "@/lib/notifications"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const ticket = await prisma.ticket.findFirst({ where: { id, companyId: user.companyId, author: { role: "PARTNER" } } })
    if (!ticket) throw new ApiError(404, "Chamado não encontrado")

    const { message } = await request.json()
    if (!message?.trim()) throw new ApiError(400, "Mensagem obrigatória")

    await prisma.ticketMessage.create({ data: { ticketId: id, authorId: user.id, message: message.trim() } })
    const updated = await prisma.ticket.update({
      where: { id },
      data: { status: "ANSWERED", updatedAt: new Date() },
      include: {
        author: { select: { id: true, name: true, role: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      },
    })

    await notifyUser({
      userId: ticket.authorId,
      type: "TICKET_MESSAGE_RECEIVED",
      title: `${user.name} respondeu`,
      message: `"${ticket.subject}" — ${message.trim().slice(0, 120)}`,
      linkUrl: "/partner",
    }).catch(() => {})

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
