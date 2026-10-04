import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { applyChecklistReview } from "@/lib/checklist-review"
import { isDayClosed } from "@/lib/shift-closing-lock"
import { logAudit } from "@/lib/audit"

/**
 * Double-check da Gerente/Master sobre uma tarefa SUBMITTED pelo colaborador,
 * ou "Recusar/Reabrir" (status=RETURNED) de uma tarefa já APPROVED — manual
 * ou auto-aprovada (requiresApproval=false) — enquanto o fechamento do
 * expediente do dia ainda não foi concluído:
 * - APPROVED: confirma e credita XP (integral se dentro do prazo, 0 se fora).
 * - RETURNED: devolve para o colaborador refazer (volta a PENDING), com
 *   observação. A partir de APPROVED, reverte o XP já creditado.
 * - REJECTED: "não entregue" definitivo — penaliza XP, exige justificativa.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const checklist = await prisma.checklist.findFirst({
      where: { id, companyId },
      include: { employee: { select: { role: true } } },
    })
    if (!checklist) throw new ApiError(404, "Checklist não encontrado")

    // Tarefa escalada para a própria Gerente (ausência do principal/secundário)
    // não pode ser autoavaliada — só o Master (ou Admin) decide sobre ela.
    if (checklist.employee?.role === "COMPANY_GERENTE" && user.role === "COMPANY_GERENTE") {
      throw new ApiError(403, "Tarefas atribuídas à Gerente só podem ser avaliadas pelo Master")
    }

    const body = await request.json()
    const { status, note, rejectionKind } = body as {
      status: "APPROVED" | "RETURNED" | "REJECTED"
      note?: string
      rejectionKind?: "FRAUD" | "PARTIAL"
    }
    if (!["APPROVED", "RETURNED", "REJECTED"].includes(status)) throw new ApiError(400, "Status inválido")
    if (rejectionKind && !["FRAUD", "PARTIAL"].includes(rejectionKind)) throw new ApiError(400, "Classificação de recusa inválida")

    const isReopeningApproved = status === "RETURNED" && checklist.status === "APPROVED"

    if (isReopeningApproved) {
      if (await isDayClosed(companyId, checklist.forDate)) {
        throw new ApiError(400, "O expediente deste dia já foi fechado — não é mais possível recusar/reabrir esta tarefa")
      }
      if (!note?.trim()) throw new ApiError(400, "Descreva o motivo")
    } else if (status === "RETURNED" || status === "REJECTED") {
      if (checklist.status !== "SUBMITTED" && checklist.status !== "PENDING") {
        throw new ApiError(400, "Checklist já foi finalizado")
      }
      if (!note?.trim()) throw new ApiError(400, "Descreva o motivo")
    } else if (checklist.status !== "SUBMITTED") {
      throw new ApiError(400, "Só é possível aprovar uma tarefa já entregue pelo colaborador")
    }

    const { updated, onTime } = await applyChecklistReview({
      checklistId: id,
      companyId,
      status,
      note,
      reviewerId: user.id,
      rejectionKind: status === "REJECTED" ? rejectionKind : undefined,
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: status,
      entity: "Checklist",
      entityId: id,
      details: { onTime, note, reopened: isReopeningApproved, rejectionKind },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
