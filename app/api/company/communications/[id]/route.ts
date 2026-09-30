import type { InternalMessageStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { isCompanyMasterOrAdmin } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

async function loadVisibleMessage(id: string, user: Awaited<ReturnType<typeof requireCompanyStaff>>) {
  const message = await prisma.internalMessage.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      recipientSector: { select: { id: true, name: true } },
      recipientEmployee: { select: { id: true, name: true } },
      replies: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
  })
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
    throw new ApiError(403, "Sem permissão para ver esta comunicação")
  }

  return message
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params
    const message = await loadVisibleMessage(id, user)
    return Response.json(message)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Marca a comunicação como Concluída (ou reabre) — Master ou o próprio remetente. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params
    const message = await loadVisibleMessage(id, user)

    const isMaster = isCompanyMasterOrAdmin(user.role)
    if (!isMaster && message.senderId !== user.id) throw new ApiError(403, "Só o Master ou quem enviou pode concluir esta comunicação")

    const body = await request.json()
    const { status } = body as { status: InternalMessageStatus }
    if (!["PENDING_RESPONSE", "RESPONDED", "CONCLUDED"].includes(status)) throw new ApiError(400, "Status inválido")

    const updated = await prisma.internalMessage.update({ where: { id }, data: { status } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "InternalMessage", entityId: id, details: { status } })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
