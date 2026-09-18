import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification || notification.userId !== user.id) throw new ApiError(404, "Notificação não encontrada")

    const updated = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } })
    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
