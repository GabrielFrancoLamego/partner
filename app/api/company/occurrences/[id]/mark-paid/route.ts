import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canAccessFinanceModule } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

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
    }

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
