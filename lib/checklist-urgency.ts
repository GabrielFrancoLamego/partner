const FIFTEEN_MIN_MS = 15 * 60 * 1000

export type ChecklistUrgency = "OVERDUE" | "SOON" | "NORMAL"

/** Código de cor de urgência de uma tarefa pendente — vermelho estourado, laranja <15min, neutro no prazo. */
export function resolveChecklistUrgency(dueAt: string | null, now = Date.now()): ChecklistUrgency {
  if (!dueAt) return "NORMAL"
  const due = new Date(dueAt).getTime()
  const diff = due - now
  if (diff <= 0) return "OVERDUE"
  if (diff <= FIFTEEN_MIN_MS) return "SOON"
  return "NORMAL"
}

export const CHECKLIST_URGENCY_CLASSES: Record<ChecklistUrgency, string> = {
  OVERDUE: "border-red-300 bg-red-50",
  SOON: "border-orange-300 bg-orange-50",
  NORMAL: "border-gray-100 bg-white",
}

export const CHECKLIST_URGENCY_TEXT_CLASSES: Record<ChecklistUrgency, string> = {
  OVERDUE: "text-red-700",
  SOON: "text-orange-700",
  NORMAL: "text-gray-500",
}

/** Estado completo de exibição — igual a ChecklistUrgency, mas com DONE prevalecendo sobre o prazo uma vez entregue. */
export type ChecklistDisplayState = ChecklistUrgency | "DONE"

/** Neutro/Verde no prazo, Laranja <=15min, Vermelho atrasado, Azul quando já concluído (SUBMITTED ou APPROVED). */
export function resolveChecklistDisplayState(status: string, dueAt: string | null, now = Date.now()): ChecklistDisplayState {
  if (status === "SUBMITTED" || status === "APPROVED") return "DONE"
  return resolveChecklistUrgency(dueAt, now)
}

export const CHECKLIST_DISPLAY_CLASSES: Record<ChecklistDisplayState, string> = {
  DONE: "border-blue-300 bg-blue-50",
  OVERDUE: "border-red-300 bg-red-50",
  SOON: "border-orange-300 bg-orange-50",
  NORMAL: "border-green-200 bg-green-50/40",
}

export const CHECKLIST_DISPLAY_TEXT_CLASSES: Record<ChecklistDisplayState, string> = {
  DONE: "text-blue-700",
  OVERDUE: "text-red-700",
  SOON: "text-orange-700",
  NORMAL: "text-green-700",
}

export const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** 1º horário limite (sem prazo = por último) -> 2º prioridade (Alta > Média > Baixa) -> 3º ordem alfabética. */
export function sortChecklists<T extends { dueAt: string | null; priority: string; title: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
    if (aDue !== bDue) return aDue - bDue
    const aPri = PRIORITY_ORDER[a.priority] ?? 1
    const bPri = PRIORITY_ORDER[b.priority] ?? 1
    if (aPri !== bPri) return aPri - bPri
    return a.title.localeCompare(b.title, "pt-BR")
  })
}
