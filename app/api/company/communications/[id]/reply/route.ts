import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { isCompanyMasterOrAdmin } from "@/lib/permissions"
import { notifyUser } from "@/lib/notifications"
import { logAudit } from "@/lib/audit"

/**
 * Resposta numa thread de Comunicação Interna. Quando quem responde não é o
 * remetente original, o status vira RESPONDED (aguardando o remetente ver);
 * quando o próprio remetente volta a escrever, o status retorna a
 * PENDING_RESPONSE (aguardando o destinatário de novo).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id: messageId } = await params

    const message = await prisma.internalMessage.findFirst({ where: { id: messageId, companyId: user.companyId } })
    if (!message) throw new ApiError(404, "Comunicação não encontrada")

    const isMaster = isCompanyMasterOrAdmin(user.role)
    const isSender = message.senderId === user.id
    const isDirectRecipient = message.recipientType === "EMPLOYEE" && message.recipientEmployeeId === user.id
    const isRoleRecipient = message.recipientType === "ROLE" && message.recipientRole === user.role
    const isSectorRecipient =
      message.recipientType === "SECTOR" &&
      message.recipientSectorId === user.employeeProfile?.sectorId &&
      Boolean(user.employeeProfile?.isSectorCommunicationResponsible)
    if (!isMaster && !isSender && !isDirectRecipient && !isRoleRecipient && !isSectorRecipient) {
      throw new ApiError(403, "Sem permissão para responder esta comunicação")
    }

    const body = await request.json()
    const { body: replyBody } = body as { body: string }
    if (!replyBody?.trim()) throw new ApiError(400, "Escreva uma mensagem")

    const nextStatus = user.id === message.senderId ? "PENDING_RESPONSE" : "RESPONDED"

    const [reply] = await prisma.$transaction([
      prisma.internalMessageReply.create({
        data: { messageId, authorId: user.id, body: replyBody.trim() },
        include: { author: { select: { id: true, name: true, role: true } } },
      }),
      prisma.internalMessage.update({ where: { id: messageId }, data: { status: nextStatus } }),
    ])

    await logAudit({ userId: user.id, companyId: user.companyId, action: "CREATE", entity: "InternalMessageReply", entityId: reply.id })

    if (user.id !== message.senderId) {
      await notifyUser({
        userId: message.senderId,
        type: "INTERNAL_MESSAGE_RECEIVED",
        title: `Resposta em "${message.subject}"`,
        message: `${user.name} respondeu sua comunicação interna.`,
        linkUrl: `/company/comunicacao?message=${messageId}`,
      }).catch(() => {})
    }

    return Response.json(reply, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
