import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"

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

export async function POST(request: Request) {
  try {
    const user = await requirePartner()
    const { subject, message } = await request.json()
    if (!subject?.trim() || !message?.trim()) throw new ApiError(400, "Assunto e mensagem são obrigatórios")

    const ticket = await prisma.ticket.create({
      data: {
        companyId: null,
        authorId: user.id,
        subject: subject.trim(),
        messages: { create: { authorId: user.id, message: message.trim() } },
      },
      include: { messages: true },
    })

    return Response.json(ticket, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
