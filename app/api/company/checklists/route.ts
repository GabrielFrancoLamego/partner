import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { ensureTodayChecklistInstances, eligibleSharedChecklistWhere, previewChecklistsForDate } from "@/lib/checklist-engine"

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
    const dateParam = searchParams.get("date")
    if (isTeamScope) requireCapability(user, canManageDailyOperations)

    // "Amanhã" (ou qualquer data futura) — sem instância real no banco ainda,
    // devolve uma pré-visualização somente leitura a partir dos templates.
    if (isTeamScope && dateParam) {
      const target = startOfDay(new Date(dateParam))
      if (target.getTime() > startOfDay(new Date()).getTime()) {
        const preview = await previewChecklistsForDate(companyId, target)
        return Response.json({ checklists: preview, efficiency: null, isPreview: true })
      }
    }

    let scopeWhere: Record<string, unknown> = {}
    if (!isTeamScope) {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { sectorId: true, tag: true } })
      // Minhas tarefas (já reservadas/atribuídas) + o pool compartilhado
      // (FREE/SECTOR/TAG) ainda sem reserva que eu sou elegível a "Vou Fazer".
      scopeWhere = { OR: [{ employeeId: user.id }, eligibleSharedChecklistWhere(profile?.tag ?? null, profile?.sectorId ?? null)] }
    }

    const checklists = await prisma.checklist.findMany({
      where: {
        companyId,
        ...scopeWhere,
        ...(status ? { status: status as "PENDING" | "SUBMITTED" | "APPROVED" | "RETURNED" | "REJECTED" } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, role: true, employeeProfile: { select: { sectorId: true } } } },
        unit: { select: { id: true, name: true } },
        template: { select: { id: true, title: true, recurrence: true, requiresPhoto: true, instructionPhotoUrl: true, instructionVideoUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    let efficiency: { total: number; approved: number; percent: number } | null = null
    if (!isTeamScope) {
      const today = startOfDay(new Date())
      // Tarefas compartilhadas ainda não reservadas (employeeId null) não são
      // "minhas" de fato ainda — não contam na eficiência até alguém reservar.
      const todays = checklists.filter((c) => new Date(c.forDate).getTime() === today.getTime() && c.employeeId !== null)
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
 * Colaborador registra uma tarefa AVULSA (sem template, sem recorrência) —
 * qualquer ChecklistTemplate (SPECIFIC, FREE, SECTOR ou TAG) já tem a
 * instância do dia criada preventivamente por ensureTodayChecklistInstances()
 * (a de FREE/SECTOR/TAG fica compartilhada, employeeId null, até alguém
 * reservar via POST .../[id]/claim) — pra executar uma tarefa de template, o
 * colaborador sempre usa .../[id]/submit (claim primeiro, se for o caso),
 * nunca este endpoint.
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const formData = await request.formData()
    const titleRaw = formData.get("title")
    const notes = formData.get("notes")
    const priorityRaw = formData.get("priority")
    const file = formData.get("file")

    const title = typeof titleRaw === "string" ? titleRaw.trim() : ""
    const priority = typeof priorityRaw === "string" && priorityRaw ? priorityRaw : "MEDIUM"
    const unitId: string | null = null
    const dueAt: Date | null = null
    const resolvedTemplateId: string | null = null
    const requiresPhoto = true

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
