import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { applyChecklistReview } from "@/lib/checklist-review"

/**
 * Colaborador entrega (com foto, se o template exigir) uma instância já
 * atribuída a ele — vai para SUBMITTED, aguardando o double-check da
 * Gerente (Aprovar/Devolver/Recusar). Só quem é o responsável ATUAL da
 * instância (employeeId) pode submeter — inclui quem recebeu por
 * reassumpção automática. Não há mais opção manual de "Não Executada" — uma
 * tarefa que nunca é entregue assume esse status automaticamente só no
 * fechamento do expediente (ver app/api/company/shift-closing).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const { id } = await params
    const companyId = user.companyId

    const checklist = await prisma.checklist.findFirst({
      where: { id, companyId },
      include: { template: { select: { requiresPhoto: true } } },
    })
    if (!checklist) throw new ApiError(404, "Tarefa não encontrada")
    if (checklist.employeeId !== user.id) throw new ApiError(403, "Esta tarefa não está atribuída a você")
    if (checklist.status !== "PENDING") throw new ApiError(400, "Esta tarefa já foi entregue")

    const formData = await request.formData()
    const action = formData.get("action")
    const notes = formData.get("notes")
    const file = formData.get("file")

    if (action === "COMPLETE") {
      const requiresPhoto = checklist.template?.requiresPhoto ?? true
      if (requiresPhoto && (!(file instanceof File) || file.size === 0)) {
        throw new ApiError(400, "Foto de comprovação é obrigatória")
      }
      const photoUrl = file instanceof File && file.size > 0 ? await uploadImage("checklists", file) : null

      let updated = await prisma.checklist.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          photoUrl,
          notes: typeof notes === "string" && notes ? notes.trim() : checklist.notes,
          rejectionReason: null,
        },
      })
      await logAudit({ userId: user.id, companyId, action: "SUBMIT", entity: "Checklist", entityId: id })

      // Template sem "Exige Aprovação do Gestor" — conclui direto, sem passar
      // pela fila de double-check (mesmo assim, Gerente/Master podem
      // "Recusar/Reabrir" até o fechamento do expediente do dia).
      if (!checklist.requiresApproval) {
        const review = await applyChecklistReview({ checklistId: id, companyId, status: "APPROVED", reviewerId: user.id })
        updated = review.updated
        await logAudit({ userId: user.id, companyId, action: "APPROVED", entity: "Checklist", entityId: id, details: { autoApproved: true } })
      }

      return Response.json(updated)
    }

    throw new ApiError(400, "Ação inválida")
  } catch (error) {
    return handleApiError(error)
  }
}
