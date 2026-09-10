import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")
    const q = searchParams.get("q")

    const tickets = await prisma.ticket.findMany({
      where: {
        ...(companyId && companyId !== "all" ? { companyId } : {}),
        ...(status ? { status: status as "OPEN" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED" } : {}),
        ...(q ? { subject: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })

    return Response.json(tickets)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Admin abre um chamado diretamente com um usuário (Master/Gerente/Colaborador/Parceiro) — o Admin já entra como 1ª mensagem. */
export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const { targetUserId, subject, message } = await request.json()
    if (!targetUserId || !subject?.trim() || !message?.trim()) {
      throw new ApiError(400, "Usuário, assunto e mensagem são obrigatórios")
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) throw new ApiError(404, "Usuário não encontrado")

    const ticket = await prisma.ticket.create({
      data: {
        companyId: targetUser.companyId,
        authorId: targetUserId,
        subject: subject.trim(),
        status: "ANSWERED",
        messages: { create: { authorId: admin.id, message: message.trim() } },
      },
      include: { messages: true, author: { select: { id: true, name: true, role: true } } },
    })

    return Response.json(ticket, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
