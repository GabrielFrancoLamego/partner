import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.occurrenceTypeConfig.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Tipo de ocorrência não encontrado")

    const body = await request.json()
    const { name, active, pointsImpact, salaryImpactType, salaryImpactValue, hoursBankImpactMinutes } = body

    const type = await prisma.occurrenceTypeConfig.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...(pointsImpact !== undefined ? { pointsImpact: Number(pointsImpact) } : {}),
        ...(salaryImpactType !== undefined ? { salaryImpactType } : {}),
        ...(salaryImpactValue !== undefined ? { salaryImpactValue: Number(salaryImpactValue) } : {}),
        ...(hoursBankImpactMinutes !== undefined ? { hoursBankImpactMinutes: Number(hoursBankImpactMinutes) } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "OccurrenceTypeConfig", entityId: id, details: body })

    return Response.json(type)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.occurrenceTypeConfig.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Tipo de ocorrência não encontrado")

    await prisma.occurrenceTypeConfig.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "OccurrenceTypeConfig", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
