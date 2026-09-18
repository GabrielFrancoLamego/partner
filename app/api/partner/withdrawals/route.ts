import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

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

    const body = await request.json()
    const { amount, companyId, pixKey } = body as { amount: number; companyId: string; pixKey?: string }

    if (!companyId) throw new ApiError(400, "Selecione a empresa para rotear o saque")
    const amountNumber = Number(amount)
    if (!amountNumber || amountNumber <= 0) throw new ApiError(400, "Valor inválido")

    const hasHistory = await prisma.commission.findFirst({ where: { partnerId: user.id, companyId } })
    if (!hasHistory) throw new ApiError(400, "Você não possui histórico de comissões nesta empresa")

    const profile = await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: user.id } })
    if (amountNumber > Number(profile.walletBalance)) throw new ApiError(400, "Saldo em carteira insuficiente")

    const finalPixKey = pixKey?.trim() || profile.pixKey
    if (!finalPixKey) throw new ApiError(400, "Cadastre uma chave PIX para solicitar o saque")

    // Regra do parceiro (front 1): cadastro básico é aceito para navegar a
    // plataforma, mas a 1ª Solicitação de Saque exige Chave PIX + Dados
    // Bancários completos — evita retrabalho do Financeiro com saque
    // aprovado sem como pagar.
    if (!profile.bankName?.trim() || !profile.agency?.trim() || !profile.accountNumber?.trim()) {
      throw new ApiError(
        400,
        "Complete seus Dados Bancários (banco, agência e conta) no seu perfil antes de solicitar um saque",
      )
    }

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
