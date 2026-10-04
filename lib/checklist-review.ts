import "server-only"
import { prisma } from "./prisma"
import { awardXp, getInternalProgramRules } from "./gamification"
import { notifyUser } from "./notifications"

type ReviewStatus = "APPROVED" | "RETURNED" | "REJECTED"
type RejectionKind = "NOT_DELIVERED" | "FRAUD" | "PARTIAL"

/**
 * Aplica a transição de revisão de um Checklist — reaproveitado em 3 lugares:
 *   1. PATCH /api/company/checklists/[id] — double-check manual da Gerente/Master.
 *   2. POST .../submit — auto-aprovação imediata quando o template tem
 *      requiresApproval=false (approvedById = o próprio colaborador).
 *   3. "Recusar/Reabrir" de uma tarefa já APPROVED (manual ou auto-aprovada),
 *      antes do fechamento do expediente — status=RETURNED a partir de
 *      APPROVED reverte o XP que já tinha sido creditado (sourceId=checklistId),
 *      já que a tarefa deixa de contar como concluída.
 */
export async function applyChecklistReview(params: {
  checklistId: string
  companyId: string
  status: ReviewStatus
  note?: string | null
  reviewerId: string | null
  /** Só relevante quando status=REJECTED — distingue Fraude (penalidade cheia) de Execução Parcial (penalidade reduzida) da auditoria manual da Gerente/Master. Default NOT_DELIVERED (sweep automático/ação sem distinção). */
  rejectionKind?: RejectionKind
}) {
  const { checklistId: id, companyId, status, note, reviewerId, rejectionKind } = params
  const checklist = await prisma.checklist.findUniqueOrThrow({ where: { id } })
  const wasApproved = checklist.status === "APPROVED"

  const now = new Date()
  const onTime = !checklist.dueAt || now <= checklist.dueAt
  const rules = await getInternalProgramRules(companyId)
  let appliedPoints = 0

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "RETURNED") {
      // Reabrir uma tarefa já aprovada reverte o XP creditado na aprovação —
      // ela deixa de contar como concluída até ser entregue de novo.
      if (wasApproved && checklist.employeeId) {
        const previousEntry = await tx.xpEntry.findFirst({
          where: { sourceId: id, reason: { in: ["CHECKLIST_ON_TIME", "CHECKLIST_EXTRA_TASK"] } },
        })
        if (previousEntry) {
          await tx.xpEntry.delete({ where: { id: previousEntry.id } })
          await tx.employeeProfile.update({
            where: { userId: checklist.employeeId },
            data: { xpPoints: { decrement: previousEntry.points } },
          })
        }
      }
      return tx.checklist.update({
        where: { id },
        data: { status: "PENDING", rejectionReason: note?.trim() || null, approvedById: null, approvedAt: null, submittedAt: null },
        include: { employee: { select: { id: true, name: true } } },
      })
    }

    const saved = await tx.checklist.update({
      where: { id },
      data: {
        status,
        approvedById: reviewerId,
        approvedAt: now,
        ...(status === "REJECTED" ? { rejectionReason: note?.trim() || null, rejectionKind: rejectionKind ?? "NOT_DELIVERED" } : {}),
      },
      include: { employee: { select: { id: true, name: true } } },
    })

    if (!checklist.employeeId) return saved

    const points = checklist.isExtraTask
      ? status === "APPROVED"
        ? rules.pointsChecklistExtraTask
        : 0
      : status === "APPROVED"
        ? onTime
          ? rules.pointsChecklistOnTime
          : rules.pointsChecklistLate
        : rejectionKind === "PARTIAL"
          ? rules.pointsChecklistPartial
          : rules.pointsChecklistFail
    appliedPoints = points
    if (points !== 0) {
      const hasEmployeeProfile = await tx.employeeProfile.findUnique({ where: { userId: checklist.employeeId } })
      if (hasEmployeeProfile) {
        await awardXp(
          {
            companyId,
            employeeId: checklist.employeeId,
            reason: checklist.isExtraTask ? "CHECKLIST_EXTRA_TASK" : "CHECKLIST_ON_TIME",
            points,
            sourceId: id,
            note: checklist.isExtraTask
              ? "Tarefa extra — ajuda voluntária"
              : status === "APPROVED"
                ? onTime
                  ? "No prazo"
                  : "Fora do prazo"
                : rejectionKind === "FRAUD"
                  ? "Fraude / não executada de fato"
                  : rejectionKind === "PARTIAL"
                    ? "Execução parcial"
                    : "Não entregue",
          },
          tx,
        )
      }
    }

    return saved
  })

  if (checklist.employeeId) {
    if (status === "RETURNED") {
      await notifyUser({
        userId: checklist.employeeId,
        type: "GENERIC",
        title: wasApproved ? `Checklist reaberto: "${updated.title}"` : `Checklist devolvido: "${updated.title}"`,
        message: wasApproved
          ? `A gerência reabriu sua tarefa já concluída para corrigir. Motivo: ${note?.trim() || "—"}`
          : `A gerência devolveu sua tarefa para refazer. Motivo: ${note?.trim() || "—"}`,
        linkUrl: "/company/checklists",
      }).catch(() => {})
    } else if (status === "REJECTED") {
      const rejectionTitle =
        rejectionKind === "FRAUD"
          ? `Checklist recusado — fraude/não executada: "${updated.title}"`
          : rejectionKind === "PARTIAL"
            ? `Checklist recusado — execução parcial: "${updated.title}"`
            : `Checklist marcado como não entregue: "${updated.title}"`
      await notifyUser({
        userId: checklist.employeeId,
        type: "GENERIC",
        title: rejectionTitle,
        message: `Motivo: ${note?.trim() || "—"}${appliedPoints !== 0 ? ` — ${appliedPoints} pontos.` : ""}`,
        linkUrl: "/company/checklists",
      }).catch(() => {})
    } else if (status === "APPROVED" && !onTime && !checklist.isExtraTask && appliedPoints !== 0) {
      await notifyUser({
        userId: checklist.employeeId,
        type: "GENERIC",
        title: `Checklist aprovado fora do prazo: "${updated.title}"`,
        message: `Entregue depois do horário limite — ${appliedPoints} pontos (em vez do valor cheio por entrega no prazo).`,
        linkUrl: "/company/checklists",
      }).catch(() => {})
    }
  }

  return { updated, appliedPoints, onTime }
}
