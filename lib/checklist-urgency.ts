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
