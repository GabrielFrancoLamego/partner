import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "ANSWERED", "RESOLVED"]

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
        messages: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      },
    })

    if (!ticket) throw new ApiError(404, "Chamado não encontrado")

    return Response.json(ticket)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const { status } = await request.json()

    if (!status || !VALID_STATUSES.includes(status)) throw new ApiError(400, "Status inválido")

    const ticket = await prisma.ticket.update({ where: { id }, data: { status } })
    return Response.json(ticket)
  } catch (error) {
    return handleApiError(error)
  }
}
