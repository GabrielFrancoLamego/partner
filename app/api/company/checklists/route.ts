import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

/** `scope=team` (Gerente/Master) traz todas as execuções da empresa; padrão é do próprio colaborador. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const isTeamScope = searchParams.get("scope") === "team"
    const status = searchParams.get("status")
    if (isTeamScope) requireCapability(user, canManageDailyOperations)

    const checklists = await prisma.checklist.findMany({
      where: {
        companyId,
        ...(isTeamScope ? {} : { employeeId: user.id }),
        ...(status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        template: { select: { id: true, title: true, recurrence: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return Response.json(checklists)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Colaborador executa uma tarefa (do template ou avulsa) com foto obrigatória. */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const formData = await request.formData()
    const templateId = formData.get("templateId")
    const titleRaw = formData.get("title")
    const notes = formData.get("notes")
    const priorityRaw = formData.get("priority")
    const file = formData.get("file")

    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Foto de comprovação é obrigatória")

    let title = typeof titleRaw === "string" ? titleRaw.trim() : ""
    let priority = typeof priorityRaw === "string" && priorityRaw ? priorityRaw : "MEDIUM"
    let unitId: string | null = null
    let dueAt: Date | null = null
    let resolvedTemplateId: string | null = null

    if (typeof templateId === "string" && templateId) {
      const template = await prisma.checklistTemplate.findFirst({ where: { id: templateId, companyId, active: true } })
      if (!template) throw new ApiError(404, "Tarefa recorrente não encontrada")
      resolvedTemplateId = template.id
      title = title || template.title
      priority = priorityRaw ? priority : template.priority
      unitId = template.unitId
      const [h, m] = template.dueTime.split(":").map(Number)
      dueAt = new Date()
      dueAt.setHours(h, m, 0, 0)
    }

    if (!title) throw new ApiError(400, "Título é obrigatório")

    const photoUrl = await uploadImage("checklists", file)

    const checklist = await prisma.checklist.create({
      data: {
        companyId,
        unitId,
        templateId: resolvedTemplateId,
        employeeId: user.id,
        title,
        notes: typeof notes === "string" && notes ? notes.trim() : null,
        photoUrl,
        priority: priority as "LOW" | "MEDIUM" | "HIGH",
        dueAt,
        status: "PENDING",
      },
      include: { template: { select: { id: true, title: true } }, unit: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "Checklist", entityId: checklist.id, details: { title, templateId: resolvedTemplateId } })

    return Response.json(checklist, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
