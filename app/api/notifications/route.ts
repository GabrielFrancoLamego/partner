import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError } from "@/lib/api-auth"

/** Lista as notificações do usuário logado (qualquer role) — sino do dashboard. */
export async function GET() {
  try {
    const user = await requireUser()
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ])
    return Response.json({ notifications, unreadCount })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Marca todas as notificações do usuário logado como lidas. */
export async function PATCH() {
  try {
    const user = await requireUser()
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
