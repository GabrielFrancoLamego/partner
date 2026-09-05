import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.sector.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Setor não encontrado")

    const body = await request.json()
    const { name, description } = body

    const sector = await prisma.sector.update({
      where: { id },
      data: { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description: description || null } : {}) },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "Sector", entityId: id, details: body })

    return Response.json(sector)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.sector.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Setor não encontrado")

    await prisma.sector.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId, action: "DELETE", entity: "Sector", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
