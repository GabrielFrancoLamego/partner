import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const { id } = await params

    const existing = await prisma.companyCalendarEvent.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Evento não encontrado")

    await prisma.companyCalendarEvent.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "CompanyCalendarEvent", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
