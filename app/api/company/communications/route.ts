import type { InternalMessageRecipientType, InternalMessageStatus, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { isCompanyMasterOrAdmin } from "@/lib/permissions"
import { uploadPublicDocument } from "@/lib/storage"
import { notifyUser } from "@/lib/notifications"
import { logAudit } from "@/lib/audit"

const RECIPIENT_TYPES: InternalMessageRecipientType[] = ["SECTOR", "ROLE", "EMPLOYEE"]
const STATUSES: InternalMessageStatus[] = ["SENT", "PENDING_RESPONSE", "RESPONDED", "CONCLUDED"]

const messageInclude = {
  sender: { select: { id: true, name: true, role: true } },
  recipientSector: { select: { id: true, name: true } },
  recipientEmployee: { select: { id: true, name: true } },
  _count: { select: { replies: true } },
} as const

/**
 * Central de Comunicações Internas — Master vê todas as mensagens da empresa;
 * demais usuários veem só as que enviaram, as endereçadas ao seu Setor
 * (quando responsável, ver EmployeeProfile.isSectorCommunicationResponsible),
 * à sua Role ou diretamente a eles.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const isMaster = isCompanyMasterOrAdmin(user.role)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const mineOnly = searchParams.get("mine") === "1"
    const employeeId = searchParams.get("employeeId")
    const sectorId = searchParams.get("sectorId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const visibilityOR: Record<string, unknown>[] = [
      { senderId: user.id },
      { recipientType: "ROLE", recipientRole: user.role },
      { recipientType: "EMPLOYEE", recipientEmployeeId: user.id },
    ]
    if (user.employeeProfile?.isSectorCommunicationResponsible && user.employeeProfile.sectorId) {
      visibilityOR.push({ recipientType: "SECTOR", recipientSectorId: user.employeeProfile.sectorId })
    }

    const where: Record<string, unknown> = {
      companyId,
      ...(isMaster ? {} : { OR: visibilityOR }),
      ...(mineOnly ? { senderId: user.id } : {}),
      ...(status && STATUSES.includes(status as InternalMessageStatus) ? { status } : {}),
      // Filtros de auditoria — exclusivos do Master, usados pela tela de Auditoria Geral.
      ...(isMaster && employeeId ? { OR: [{ senderId: employeeId }, { recipientType: "EMPLOYEE", recipientEmployeeId: employeeId }] } : {}),
      ...(isMaster && sectorId ? { recipientType: "SECTOR", recipientSectorId: sectorId } : {}),
      ...(isMaster && (startDate || endDate)
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    }

    const messages = await prisma.internalMessage.findMany({
      where,
      include: messageInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    })

    return Response.json(messages)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const formData = await request.formData()
    const recipientType = formData.get("recipientType")
    const recipientSectorId = formData.get("recipientSectorId")
    const recipientRole = formData.get("recipientRole")
    const recipientEmployeeId = formData.get("recipientEmployeeId")
    const subject = formData.get("subject")
    const body = formData.get("body")
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)

    if (typeof recipientType !== "string" || !RECIPIENT_TYPES.includes(recipientType as InternalMessageRecipientType)) {
      throw new ApiError(400, "Destinatário inválido")
    }
    if (typeof subject !== "string" || !subject.trim()) throw new ApiError(400, "Assunto é obrigatório")
    if (typeof body !== "string" || !body.trim()) throw new ApiError(400, "Mensagem é obrigatória")

    if (recipientType === "SECTOR") {
      if (typeof recipientSectorId !== "string" || !recipientSectorId) throw new ApiError(400, "Selecione o setor")
      const sector = await prisma.sector.findFirst({ where: { id: recipientSectorId, companyId } })
      if (!sector) throw new ApiError(404, "Setor não encontrado nesta empresa")
    }
    if (recipientType === "ROLE" && (typeof recipientRole !== "string" || !recipientRole)) {
      throw new ApiError(400, "Selecione a função/setor de destino")
    }
    if (recipientType === "EMPLOYEE") {
      if (typeof recipientEmployeeId !== "string" || !recipientEmployeeId) throw new ApiError(400, "Selecione o colaborador")
      const employee = await prisma.user.findFirst({ where: { id: recipientEmployeeId, companyId } })
      if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
    }

    if (files.length > 5) throw new ApiError(400, "Máximo de 5 anexos por mensagem")
    for (const f of files) {
      if (f.size > 8 * 1024 * 1024) throw new ApiError(400, `Arquivo "${f.name}" excede 8MB`)
    }
    const attachmentUrls = await Promise.all(files.map((f) => uploadPublicDocument("communications", f)))

    const message = await prisma.internalMessage.create({
      data: {
        companyId,
        senderId: user.id,
        recipientType: recipientType as InternalMessageRecipientType,
        recipientSectorId: recipientType === "SECTOR" ? (recipientSectorId as string) : null,
        recipientRole: recipientType === "ROLE" ? (recipientRole as Role) : null,
        recipientEmployeeId: recipientType === "EMPLOYEE" ? (recipientEmployeeId as string) : null,
        subject: subject.trim(),
        body: body.trim(),
        attachmentUrls,
        status: "PENDING_RESPONSE",
      },
      include: messageInclude,
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "InternalMessage", entityId: message.id })

    // Notifica o(s) destinatário(s) — best-effort, não bloqueia a criação da mensagem.
    const notifyPayload = {
      type: "INTERNAL_MESSAGE_RECEIVED" as const,
      title: `Nova comunicação: ${message.subject}`,
      message: `${user.name} enviou uma comunicação interna — "${message.subject}"`,
      linkUrl: `/company/comunicacao?message=${message.id}`,
    }
    if (recipientType === "EMPLOYEE" && recipientEmployeeId) {
      await notifyUser({ ...notifyPayload, userId: recipientEmployeeId as string }).catch(() => {})
    } else if (recipientType === "SECTOR" && recipientSectorId) {
      const responsibles = await prisma.user.findMany({
        where: { companyId, role: "EMPLOYEE", employeeProfile: { sectorId: recipientSectorId as string, isSectorCommunicationResponsible: true } },
        select: { id: true },
      })
      await Promise.all(responsibles.map((r) => notifyUser({ ...notifyPayload, userId: r.id }).catch(() => {})))
    } else if (recipientType === "ROLE" && recipientRole) {
      const roleUsers = await prisma.user.findMany({ where: { companyId, role: recipientRole as Role, status: "ACTIVE" }, select: { id: true } })
      await Promise.all(roleUsers.map((r) => notifyUser({ ...notifyPayload, userId: r.id }).catch(() => {})))
    }

    return Response.json(message, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
