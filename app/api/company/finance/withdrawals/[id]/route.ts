import { prisma } from "@/lib/prisma"
import { handleApiError, ApiError, requireFinanceContext } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"
import { addBusinessHours, DEFAULT_WITHDRAWAL_PAYMENT_BUSINESS_HOURS } from "@/lib/business-time"

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

/**
 * Aprovar/reprovar a SOLICITAÇÃO de saque de um parceiro — esta etapa só valida
 * o pedido, não paga. Aprovado vira conta a pagar (ver
 * /api/company/finance/payables) e o pagamento acontece em
 * /api/company/finance/settle, com forma de pagamento e comprovante.
 * Reprovar exige justificativa e estorna o valor à carteira do parceiro (o
 * saque é debitado na solicitação, ver app/api/partner/withdrawals).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)
    const { id } = await params
    const companyId = scopeCompanyId

    const existing = await prisma.withdrawal.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Saque não encontrado")

    const body = await request.json()
    const status = body.status as string
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : ""
    if (status !== "APPROVED" && status !== "REJECTED") {
      throw new ApiError(400, "Status inválido — o pagamento é feito em Contas a Pagar, com comprovante")
    }
    if (existing.status !== "PENDING") throw new ApiError(400, "Esta solicitação já foi analisada")
    if (status === "REJECTED" && !rejectionReason) throw new ApiError(400, "Informe a justificativa da reprovação")

    // Data/Hora Prevista de Pagamento: a informada na aprovação ou, sem ela, 24 horas úteis a partir de agora.
    const approvedAt = new Date()
    let expectedPaymentDate = addBusinessHours(approvedAt, DEFAULT_WITHDRAWAL_PAYMENT_BUSINESS_HOURS)
    if (status === "APPROVED" && typeof body.expectedPaymentDate === "string" && body.expectedPaymentDate) {
      const informed = new Date(body.expectedPaymentDate)
      if (Number.isNaN(informed.getTime())) throw new ApiError(400, "Data/Hora prevista de pagamento inválida")
      if (informed.getTime() < approvedAt.getTime() - 60 * 1000) throw new ApiError(400, "A data prevista de pagamento não pode estar no passado")
      expectedPaymentDate = informed
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const saved = await tx.withdrawal.update({
        where: { id },
        data: status === "APPROVED" ? { status, approvedAt, expectedPaymentDate } : { status, rejectionReason },
      })

      if (status === "REJECTED") {
        await tx.partnerProfile.update({
          where: { userId: existing.partnerId },
          data: { walletBalance: { increment: existing.amount } },
        })
        await tx.walletTransaction.create({
          data: {
            companyId,
            partnerId: existing.partnerId,
            type: "MANUAL_CREDIT",
            amount: existing.amount,
            description: "Estorno de saque negado",
            status: "COMPLETED",
            createdById: user.id,
          },
        })
      }

      return saved
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: "PIX_APPROVAL",
      entity: "Withdrawal",
      entityId: id,
      details: { status, rejectionReason, expectedPaymentDate: status === "APPROVED" ? expectedPaymentDate : undefined },
    })

    await notifyUser({
      userId: existing.partnerId,
      type: status === "APPROVED" ? "WITHDRAWAL_APPROVED" : "GENERIC",
      title: status === "APPROVED" ? "Saque aprovado" : "Saque reprovado",
      message:
        status === "APPROVED"
          ? `Seu saque de ${money(Number(existing.amount))} foi aprovado — pagamento previsto para ${expectedPaymentDate.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
          : `Seu saque de ${money(Number(existing.amount))} foi reprovado e o valor voltou à sua carteira. Motivo: ${rejectionReason}`,
      linkUrl: "/partner/carteira/saques",
    }).catch(() => {})

    return Response.json(withdrawal)
  } catch (error) {
    return handleApiError(error)
  }
}
