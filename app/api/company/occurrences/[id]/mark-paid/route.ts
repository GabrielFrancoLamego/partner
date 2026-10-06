import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

/**
 * Financeiro reagenda a Data Prevista de Pagamento de uma ocorrência ainda
 * PENDING (folha, meta, diária). A QUITAÇÃO em si (forma de pagamento +
 * comprovante obrigatório) é feita em POST /api/company/finance/settle.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
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
