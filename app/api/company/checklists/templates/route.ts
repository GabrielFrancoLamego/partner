import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const templates = await prisma.checklistTemplate.findMany({
      where: { companyId: user.companyId, active: true },
      include: { unit: { select: { id: true, name: true } }, _count: { select: { instances: true } } },
      orderBy: { title: "asc" },
    })
    return Response.json(templates)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { title, description, recurrence, priority, dueTime, unitId } = body
    if (!title || !recurrence || !dueTime) throw new ApiError(400, "Título, recorrência e horário são obrigatórios")

    if (unitId) {
      const unit = await prisma.unit.findFirst({ where: { id: unitId, companyId } })
      if (!unit) throw new ApiError(404, "Unidade não encontrada nesta empresa")
    }

    const template = await prisma.checklistTemplate.create({
      data: { companyId, unitId: unitId || null, title, description, recurrence, priority: priority ?? "MEDIUM", dueTime, createdById: user.id },
      include: { unit: { select: { id: true, name: true } }, _count: { select: { instances: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "ChecklistTemplate", entityId: template.id, details: { title } })

    return Response.json(template, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
