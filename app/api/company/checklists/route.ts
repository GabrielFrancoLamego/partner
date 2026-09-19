import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { ensureTodayChecklistInstances } from "@/lib/checklist-engine"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** `scope=team` (Gerente/Master) traz todas as execuções da empresa; padrão é do próprio colaborador. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    await ensureTodayChecklistInstances(companyId)

    const { searchParams } = new URL(request.url)
    const isTeamScope = searchParams.get("scope") === "team"
    const status = searchParams.get("status")
    if (isTeamScope) requireCapability(user, canManageDailyOperations)

    const checklists = await prisma.checklist.findMany({
      where: {
        companyId,
        ...(isTeamScope ? {} : { employeeId: user.id }),
        ...(status ? { status: status as "PENDING" | "SUBMITTED" | "APPROVED" | "RETURNED" | "REJECTED" } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        unit: { select: { id: true, name: true } },
        template: { select: { id: true, title: true, recurrence: true, requiresPhoto: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    let efficiency: { total: number; approved: number; percent: number } | null = null
    if (!isTeamScope) {
      const today = startOfDay(new Date())
      const todays = checklists.filter((c) => new Date(c.forDate).getTime() === today.getTime())
      const total = todays.length
      const approved = todays.filter((c) => c.status === "APPROVED").length
      efficiency = { total, approved, percent: total > 0 ? Math.round((approved / total) * 100) : 100 }
    }

    return Response.json({ checklists, efficiency })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Colaborador executa uma tarefa AVULSA (sem template) ou um template SEM
 * responsável pré-definido — o modelo antigo, livre. Templates com
 * primaryEmployeeId configurado já têm a instância do dia criada por
 * ensureTodayChecklistInstances(); para essas, o colaborador usa
 * POST .../[id]/submit na instância existente, não este endpoint.
 */
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

    let title = typeof titleRaw === "string" ? titleRaw.trim() : ""
    let priority = typeof priorityRaw === "string" && priorityRaw ? priorityRaw : "MEDIUM"
    let unitId: string | null = null
    let dueAt: Date | null = null
    let resolvedTemplateId: string | null = null
    let requiresPhoto = true

    if (typeof templateId === "string" && templateId) {
      const template = await prisma.checklistTemplate.findFirst({ where: { id: templateId, companyId, active: true } })
      if (!template) throw new ApiError(404, "Tarefa recorrente não encontrada")
      if (template.primaryEmployeeId) {
        throw new ApiError(400, "Esta tarefa já tem responsável definido — use a instância do dia atribuída a você")
      }
      resolvedTemplateId = template.id
      title = title || template.title
      priority = priorityRaw ? priority : template.priority
      unitId = template.unitId
      requiresPhoto = template.requiresPhoto
      const [h, m] = template.dueTime.split(":").map(Number)
      dueAt = new Date()
      dueAt.setHours(h, m, 0, 0)
    }

    if (!title) throw new ApiError(400, "Título é obrigatório")
    if (requiresPhoto && (!(file instanceof File) || file.size === 0)) {
      throw new ApiError(400, "Foto de comprovação é obrigatória")
    }

    const photoUrl = file instanceof File && file.size > 0 ? await uploadImage("checklists", file) : null

    const checklist = await prisma.checklist.create({
      data: {
        companyId,
        unitId,
        templateId: resolvedTemplateId,
        employeeId: user.id,
        forDate: startOfDay(new Date()),
        title,
        notes: typeof notes === "string" && notes ? notes.trim() : null,
        photoUrl,
        priority: priority as "LOW" | "MEDIUM" | "HIGH",
        dueAt,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      include: { template: { select: { id: true, title: true } }, unit: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "Checklist", entityId: checklist.id, details: { title, templateId: resolvedTemplateId } })

    return Response.json(checklist, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
