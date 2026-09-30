import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { requirePartnerAdesaoComplete } from "@/lib/partner-adesao"

export async function GET() {
  try {
    const user = await requirePartner()

    const withdrawals = await prisma.withdrawal.findMany({
      where: { partnerId: user.id },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { requestDate: "desc" },
      take: 200,
    })

    return Response.json(withdrawals)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Solicita um saque — debita PartnerProfile.walletBalance (saldo único e
 * global do parceiro) imediatamente, como retenção; se o Financeiro reprovar,
 * o valor é estornado (ver app/api/company/finance/withdrawals/[id]).
 * `companyId` define para qual time financeiro a solicitação é roteada —
 * precisa ser uma empresa onde o parceiro já tem histórico de comissões.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePartner()
    await requirePartnerAdesaoComplete(user.id)

    const body = await request.json()
    const { amount, companyId, pixKey } = body as { amount: number; companyId: string; pixKey?: string }

    if (!companyId) throw new ApiError(400, "Selecione a empresa para rotear o saque")
    const amountNumber = Number(amount)
    if (!amountNumber || amountNumber <= 0) throw new ApiError(400, "Valor inválido")

    const hasHistory = await prisma.commission.findFirst({ where: { partnerId: user.id, companyId } })
    if (!hasHistory) throw new ApiError(400, "Você não possui histórico de comissões nesta empresa")

    const profile = await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: user.id } })
    if (amountNumber > Number(profile.walletBalance)) throw new ApiError(400, "Saldo em carteira insuficiente")

    // Etapa 2 do cadastro (CPF + PIX ou dados bancários) já garantida por
    // requirePartnerAdesaoComplete acima — aqui só falta ter uma chave PIX de
    // fato pra rotear o pagamento (o parceiro pode digitar uma nova na hora).
    const finalPixKey = pixKey?.trim() || profile.pixKey
    if (!finalPixKey) throw new ApiError(400, "Informe a Chave PIX para receber este saque")

    const withdrawal = await prisma.$transaction(async (tx) => {
      const created = await tx.withdrawal.create({
        data: { companyId, partnerId: user.id, amount: amountNumber, pixKey: finalPixKey, status: "PENDING" },
        include: { company: { select: { id: true, name: true } } },
      })

      await tx.partnerProfile.update({ where: { userId: user.id }, data: { walletBalance: { decrement: amountNumber } } })

      await tx.walletTransaction.create({
        data: {
          companyId,
          partnerId: user.id,
          type: "WITHDRAWAL",
          amount: amountNumber,
          description: "Saque PIX solicitado",
          status: "PENDING",
          createdById: user.id,
        },
      })

      return created
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "Withdrawal", entityId: withdrawal.id, details: { amount: amountNumber } })

    return Response.json(withdrawal, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
