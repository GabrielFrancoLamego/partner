import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const templates = await prisma.checklistTemplate.findMany({
      where: companyId && companyId !== "all" ? { companyId } : {},
      include: {
        company: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        _count: { select: { instances: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(templates)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { companyId, unitId, title, description, recurrence, priority, dueTime } = body

    if (!companyId || !title || !recurrence || !dueTime) {
      throw new ApiError(400, "Empresa, título, recorrência e horário limite são obrigatórios")
    }

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId })
    const template = await db.checklistTemplate.create({
      data: {
        companyId,
        unitId: unitId || null,
        title,
        description,
        recurrence,
        priority: priority ?? "MEDIUM",
        dueTime,
        createdById: admin.id,
      },
    })

    return Response.json(template, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
