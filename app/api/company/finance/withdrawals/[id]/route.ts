import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

const VALID_STATUSES = ["APPROVED", "REJECTED", "PAID"]

/** Saque é debitado da carteira já na solicitação (ver app/api/partner/withdrawals) — reprovar aqui estorna o valor. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.withdrawal.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Saque não encontrado")

    const body = await request.json()
    const { status, rejectionReason } = body
    if (!status || !VALID_STATUSES.includes(status)) throw new ApiError(400, "Status inválido")

    const withdrawal = await prisma.$transaction(async (tx) => {
      const saved = await tx.withdrawal.update({
        where: { id },
        data: {
          status,
          ...(status === "REJECTED" ? { rejectionReason } : {}),
          ...(status === "PAID" ? { paidAt: new Date() } : {}),
        },
      })

      if (status === "REJECTED" && existing.status === "PENDING") {
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
      details: { status, rejectionReason },
    })

    return Response.json(withdrawal)
  } catch (error) {
    return handleApiError(error)
  }
}
