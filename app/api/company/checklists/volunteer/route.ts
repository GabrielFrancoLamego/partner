import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { startOfDay, combineDateAndTime, matchesRecurrenceToday, isEmployeeAbsentToday } from "@/lib/checklist-engine"

/**
 * "Colaboração e Tarefa Extra": tarefas em que o colaborador logado é o
 * responsável SECUNDÁRIO de um template cujo principal está presente hoje
 * (se o principal estivesse ausente, o secundário já teria recebido a
 * instância principal via ensureTodayChecklistInstances — isto é só para o
 * caso de ajuda voluntária, com o principal cobrindo normalmente).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const today = startOfDay(new Date())
    const dayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const templates = await prisma.checklistTemplate.findMany({
      where: { companyId, active: true, secondaryEmployeeId: user.id, primaryEmployeeId: { not: null } },
      include: { primaryEmployee: { select: { id: true, name: true } } },
    })
    const applicable = templates.filter((t) => matchesRecurrenceToday(t, today))
    if (applicable.length === 0) return Response.json([])

    const existingExtras = await prisma.checklist.findMany({
      where: { templateId: { in: applicable.map((t) => t.id) }, forDate: today, employeeId: user.id, isExtraTask: true },
      select: { templateId: true },
    })
    const alreadyVolunteered = new Set(existingExtras.map((e) => e.templateId))

    const opportunities = []
    for (const template of applicable) {
      if (alreadyVolunteered.has(template.id)) continue
      const primaryAbsent = await isEmployeeAbsentToday(companyId, template.primaryEmployeeId!, today, dayEnd)
      if (primaryAbsent) continue // principal ausente = já é a responsabilidade principal do secundário, não é "extra"
      opportunities.push({
        templateId: template.id,
        title: template.title,
        dueTime: template.dueTime,
        requiresPhoto: template.requiresPhoto,
        primaryEmployee: template.primaryEmployee,
      })
    }

    return Response.json(opportunities)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Cria a instância "extra" do secundário para o template — segue o fluxo normal de entrega/aprovação depois, com bônus de XP distinto. */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const { templateId } = await request.json()
    if (!templateId) throw new ApiError(400, "Tarefa é obrigatória")

    const template = await prisma.checklistTemplate.findFirst({
      where: { id: templateId, companyId, active: true, secondaryEmployeeId: user.id },
    })
    if (!template || !template.primaryEmployeeId) throw new ApiError(404, "Você não é o responsável secundário desta tarefa")

    const today = startOfDay(new Date())
    const dayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const primaryAbsent = await isEmployeeAbsentToday(companyId, template.primaryEmployeeId, today, dayEnd)
    if (primaryAbsent) {
      throw new ApiError(400, "O responsável principal está ausente hoje — a tarefa já foi atribuída a você como principal, não como extra")
    }

    const existing = await prisma.checklist.findFirst({
      where: { templateId, forDate: today, employeeId: user.id, isExtraTask: true },
    })
    if (existing) return Response.json(existing, { status: 200 })

    const checklist = await prisma.checklist.create({
      data: {
        companyId,
        unitId: template.unitId,
        templateId: template.id,
        employeeId: user.id,
        forDate: today,
        title: template.title,
        notes: template.description,
        priority: template.priority,
        dueAt: combineDateAndTime(today, template.dueTime),
        status: "PENDING",
        isExtraTask: true,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "Checklist", entityId: checklist.id, details: { templateId, isExtraTask: true } })

    return Response.json(checklist, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
