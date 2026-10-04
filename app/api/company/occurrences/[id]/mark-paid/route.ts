import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canAccessFinanceModule } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"
import { maybeBlockDiaristaAfterPayment } from "@/lib/employment-access"

/**
 * Quitação de ocorrência financeira (consumo, vale, prêmio etc) no painel do
 * Financeiro — Gerente, Master e o perfil do Financeiro podem marcar como
 * Paga, com comprovante opcional. Diferente de editar/excluir a ocorrência
 * (bloqueado pro Gerente depois do fechamento do dia, ver
 * app/api/company/occurrences/[id]/route.ts): pagar costuma acontecer DEPOIS
 * do dia operacional fechar (ex: no pagamento/folha), então esta ação NÃO
 * tem a mesma trava.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    if (!canManageDailyOperations(user.role) && !canAccessFinanceModule(user)) {
      throw new ApiError(403, "Sem permissão para esta ação")
    }
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.occurrence.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Ocorrência não encontrada")
    if (existing.paymentStatus === "PAID") throw new ApiError(400, "Esta ocorrência já está marcada como paga")
    if (existing.total === null) throw new ApiError(400, "Esta ocorrência não tem valor financeiro para quitar")

    const formData = await request.formData()
    const file = formData.get("file")
    const proofUrl = file instanceof File && file.size > 0 ? await uploadImage("occurrences", file) : null

    const updated = await prisma.occurrence.update({
      where: { id },
      data: {
        paymentStatus: "PAID",
        paymentProofUrl: proofUrl,
        paidAt: new Date(),
        paidById: user.id,
      },
      include: { employee: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "MARK_PAID", entity: "Occurrence", entityId: id, details: { hasProof: Boolean(proofUrl) } })

    if (updated.employeeId) {
      await notifyUser({
        userId: updated.employeeId,
        type: "GENERIC",
        title: "Ocorrência quitada",
        message: `O pagamento da ocorrência "${updated.description ?? updated.type}" foi registrado.`,
        linkUrl: "/company/crescimento",
      }).catch(() => {})

      // Regra do DIARISTA: confirmar o pagamento da diária bloqueia o acesso
      // automaticamente (ver lib/employment-access.ts) — só a Gerente/Master
      // desbloqueia ao convocar para um novo turno.
      if (updated.type === "DIARIA") {
        await maybeBlockDiaristaAfterPayment(companyId, updated.employeeId).catch(() => {})
      }
    }

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Financeiro reagenda a Data Prevista de Pagamento de uma ocorrência ainda PENDING (folha, meta, diária). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    if (!canManageDailyOperations(user.role) && !canAccessFinanceModule(user)) {
      throw new ApiError(403, "Sem permissão para esta ação")
    }
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.occurrence.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Ocorrência não encontrada")
    if (existing.paymentStatus === "PAID") throw new ApiError(400, "Esta ocorrência já foi paga")

    const body = await request.json()
    const { expectedPaymentDate } = body as { expectedPaymentDate: string }
    if (!expectedPaymentDate) throw new ApiError(400, "Informe a nova data prevista de pagamento")

    const updated = await prisma.occurrence.update({
      where: { id },
      data: { expectedPaymentDate: new Date(expectedPaymentDate) },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "Occurrence", entityId: id, details: { expectedPaymentDate } })

    if (updated.employeeId) {
      await notifyUser({
        userId: updated.employeeId,
        type: "GENERIC",
        title: "Data prevista de pagamento alterada",
        message: `A data prevista de pagamento de um lançamento em "Sua Conta" foi atualizada para ${new Date(expectedPaymentDate).toLocaleDateString("pt-BR")}.`,
        linkUrl: "/company",
      }).catch(() => {})
    }

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
