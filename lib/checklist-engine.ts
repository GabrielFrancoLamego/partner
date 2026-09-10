import "server-only"
import type { ChecklistTemplate } from "@prisma/client"
import { prisma } from "./prisma"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function combineDateAndTime(day: Date, time: string) {
  const [h, m] = time.split(":").map(Number)
  const result = new Date(day)
  result.setHours(h || 0, m || 0, 0, 0)
  return result
}

/**
 * Decide se um template "cai" hoje, dada a recorrência configurada.
 * Simplificações assumidas (não pedidas explicitamente, documentadas aqui):
 * - Sem dia configurado (recurrenceDayOfWeek/DayOfMonth null) → recorrência
 *   "em aberto", cai todo dia (compatibilidade com templates antigos, que o
 *   colaborador sempre pôde executar a qualquer momento).
 * - BIMONTHLY/TRIMONTHLY/SEMIANNUAL/ANNUAL contam o ciclo a partir de
 *   recurrenceAnchorMonth (0=janeiro..11=dezembro; null equivale a janeiro,
 *   ex: trimestral com âncora em janeiro = jan/abr/jul/out).
 * - FORTNIGHTLY (quinzenal, já existia no enum antes deste pacote) se comporta
 *   como semanal — não há data-âncora para calcular a alternância de semanas.
 */
function matchesRecurrenceToday(template: ChecklistTemplate, today: Date): boolean {
  const dow = today.getDay()
  const month = today.getMonth() // 0-11
  const dom = today.getDate()
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const anchor = template.recurrenceAnchorMonth ?? 0
  const monthsSinceAnchor = (month - anchor + 12) % 12

  const dayOfMonthMatches =
    template.recurrenceDayOfMonth == null ||
    template.recurrenceDayOfMonth === dom ||
    (template.recurrenceDayOfMonth === -1 && dom === lastDayOfMonth)

  switch (template.recurrence) {
    case "DAILY":
      return true
    case "WEEKLY":
    case "FORTNIGHTLY":
      return template.recurrenceDayOfWeek == null || template.recurrenceDayOfWeek === dow
    case "MONTHLY":
      return dayOfMonthMatches
    case "BIMONTHLY":
      return monthsSinceAnchor % 2 === 0 && dayOfMonthMatches
    case "TRIMONTHLY":
      return monthsSinceAnchor % 3 === 0 && dayOfMonthMatches
    case "SEMIANNUAL":
      return monthsSinceAnchor % 6 === 0 && dayOfMonthMatches
    case "ANNUAL":
      return monthsSinceAnchor === 0 && dayOfMonthMatches
    default:
      return false
  }
}

async function isEmployeeAbsentToday(companyId: string, employeeId: string, dayStart: Date, dayEnd: Date) {
  const user = await prisma.user.findUnique({ where: { id: employeeId }, select: { status: true } })
  if (!user || user.status !== "ACTIVE") return true

  const checkIn = await prisma.timeEntry.findFirst({
    where: { companyId, userId: employeeId, type: "CHECK_IN", createdAt: { gte: dayStart, lt: dayEnd } },
  })
  return !checkIn
}

/**
 * Cria as instâncias de hoje para templates ativos que têm responsável
 * principal definido (templates sem responsável continuam no modelo antigo —
 * qualquer colaborador executa livremente, sem pré-atribuição). Idempotente:
 * não recria se já existe um Checklist para (templateId, forDate).
 *
 * Aplica a regra de reassumpção automática: ausente = status INACTIVE ou sem
 * check-in de ponto hoje. Principal ausente → cai no secundário; secundário
 * também ausente (ou inexistente) → cai no Master/Gerente da empresa.
 */
export async function ensureTodayChecklistInstances(companyId: string) {
  const today = startOfDay(new Date())
  const dayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const templates = await prisma.checklistTemplate.findMany({
    where: { companyId, active: true, primaryEmployeeId: { not: null } },
  })

  const applicable = templates.filter((t) => matchesRecurrenceToday(t, today))
  if (applicable.length === 0) return

  const existing = await prisma.checklist.findMany({
    where: { templateId: { in: applicable.map((t) => t.id) }, forDate: today },
    select: { templateId: true },
  })
  const alreadyCreated = new Set(existing.map((e) => e.templateId))

  for (const template of applicable) {
    if (alreadyCreated.has(template.id)) continue

    let assigneeId = template.primaryEmployeeId!
    let isAutoReassigned = false

    const primaryAbsent = await isEmployeeAbsentToday(companyId, template.primaryEmployeeId!, today, dayEnd)
    if (primaryAbsent) {
      let fallbackId: string | null = null
      if (template.secondaryEmployeeId) {
        const secondaryAbsent = await isEmployeeAbsentToday(companyId, template.secondaryEmployeeId, today, dayEnd)
        if (!secondaryAbsent) fallbackId = template.secondaryEmployeeId
      }
      if (!fallbackId) {
        const manager = await prisma.user.findFirst({
          where: { companyId, role: { in: ["COMPANY_MASTER", "COMPANY_GERENTE"] }, status: "ACTIVE" },
          orderBy: { role: "asc" }, // COMPANY_MASTER < COMPANY_GERENTE alfabeticamente — prioriza Master
        })
        fallbackId = manager?.id ?? null
      }
      if (fallbackId) {
        assigneeId = fallbackId
        isAutoReassigned = true
      }
      // Se não há secundário nem Master/Gerente ativo cadastrado (empresa mal configurada),
      // a tarefa fica com o principal mesmo ausente — melhor visível e cobrada do que perdida.
    }

    const created = await prisma.checklist.create({
      data: {
        companyId,
        unitId: template.unitId,
        templateId: template.id,
        employeeId: assigneeId,
        forDate: today,
        title: template.title,
        notes: template.description,
        priority: template.priority,
        dueAt: combineDateAndTime(today, template.dueTime),
        status: "PENDING",
        isAutoReassigned,
      },
    })

    if (isAutoReassigned) {
      await prisma.checklistReassignment.create({
        data: {
          checklistId: created.id,
          fromUserId: template.primaryEmployeeId!,
          toUserId: assigneeId,
          reassignedById: template.createdById,
          reason: "Ausência do responsável principal (auto)",
        },
      })
    }
  }
}
