import type { TimeEntryType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { isCompanyMasterOrAdmin } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

const VALID_TYPES = new Set<TimeEntryType>(["CHECK_IN", "BREAK_START", "BREAK_END", "CHECK_OUT"])

/** Corrige uma batida de ponto lançada incorretamente — exclusivo do Master. Notifica o Colaborador para dar ciência. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, isCompanyMasterOrAdmin)
    const { id } = await params

    const entry = await prisma.timeEntry.findFirst({
      where: { id, companyId: user.companyId },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    })
    if (!entry) throw new ApiError(404, "Batida não encontrada")

    const body = await request.json()
    const { type, createdAt, note } = body as { type?: TimeEntryType; createdAt?: string; note?: string }
    if (type !== undefined && !VALID_TYPES.has(type)) throw new ApiError(400, "Tipo de batida inválido")
    if (createdAt !== undefined && Number.isNaN(new Date(createdAt).getTime())) throw new ApiError(400, "Data/hora inválida")

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...(type !== undefined ? { type } : {}),
        ...(createdAt !== undefined ? { createdAt: new Date(createdAt) } : {}),
        isManagerAdjusted: true,
        adjustedById: user.id,
        adjustedAt: new Date(),
        adjustmentNote: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "UPDATE",
      entity: "TimeEntry",
      entityId: id,
      details: { before: { type: entry.type, createdAt: entry.createdAt }, after: { type: updated.type, createdAt: updated.createdAt }, note },
    })

    await notifyUser({
      userId: entry.user.id,
      type: "TIMECLOCK_ADJUSTED",
      title: "Uma batida de ponto sua foi corrigida",
      message: `O Master ajustou seu registro de ${new Date(entry.createdAt).toLocaleString("pt-BR")}. ${note ? `Motivo: ${note}` : ""}`,
      linkUrl: "/company/ponto",
      email: entry.user.email,
      phone: entry.user.phone,
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
