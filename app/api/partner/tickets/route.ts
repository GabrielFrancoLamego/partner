import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { notifyCompanyManagement } from "@/lib/notifications"

export async function GET() {
  try {
    const user = await requirePartner()
    const tickets = await prisma.ticket.findMany({
      where: { authorId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } } },
      orderBy: { updatedAt: "desc" },
    })
    return Response.json(tickets)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * `companyId` presente = chamado endereçado ao Master/Gerente daquela
 * empresa (ver app/api/company/partner-tickets, balão de Ajuda flutuante);
 * ausente = vai para o Suporte da Plataforma (Admin), comportamento original.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePartner()
    const { subject, message, companyId } = await request.json()
    if (!subject?.trim() || !message?.trim()) throw new ApiError(400, "Assunto e mensagem são obrigatórios")

    if (companyId) {
      const membership = await prisma.programMembership.findFirst({ where: { partnerId: user.id, companyId, status: "ACTIVE" } })
      if (!membership) throw new ApiError(403, "Você precisa participar do programa desta empresa para falar com ela")
    }

    const ticket = await prisma.ticket.create({
      data: {
        companyId: companyId || null,
        authorId: user.id,
        subject: subject.trim(),
        messages: { create: { authorId: user.id, message: message.trim() } },
      },
      include: { messages: true },
    })

    if (companyId) {
      await notifyCompanyManagement(companyId, {
        type: "TICKET_MESSAGE_RECEIVED",
        title: `Nova mensagem de ${user.name}`,
        message: `"${ticket.subject}" — ${message.trim().slice(0, 120)}`,
        linkUrl: "/company/comunicacao?tab=parceiros",
      }).catch(() => {})
    }

    return Response.json(ticket, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
