import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { computeReferralCommissionValue } from "@/lib/commission-format"
import { logAudit } from "@/lib/audit"

/**
 * Lançar o Valor Total da Conta de uma indicação que o cliente já consumiu (Scanner
 * PDV) mas ainda não teve o valor informado, e gerar a comissão do parceiro.
 * Comissão de Programa é recalculada pela regra do programa sobre o valor
 * lançado; comissão de Promoção mantém o custo fixo da promoção. A comissão
 * volta como PENDING — aprovar (que credita a carteira) continua uma etapa
 * explícita em /api/company/finance/commissions/[id].
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const { id } = await params
    const companyId = user.companyId

    const commission = await prisma.commission.findFirst({ where: { id, companyId }, include: { program: true } })
    if (!commission) throw new ApiError(404, "Comissão não encontrada")
    if (commission.amount !== null && commission.status !== "AWAITING_VALUE") {
      throw new ApiError(400, "O valor desta comissão já foi lançado")
    }

    const body = await request.json()
    const amount = Number(body.amount)
    const justification = typeof body.billJustification === "string" ? body.billJustification.trim() : ""
    if (body.amount === undefined || body.amount === "" || Number.isNaN(amount) || amount < 0) throw new ApiError(400, "Valor da conta inválido")
    if (amount === 0 && !justification) throw new ApiError(400, "Conta com valor R$ 0,00 exige justificativa")

    let commissionValue = commission.commissionValue !== null ? Number(commission.commissionValue) : 0
    if (commission.program && !commission.promotionId) {
      commissionValue = computeReferralCommissionValue(
        {
          commissionType: commission.program.commissionType,
          commissionFormat: commission.program.commissionFormat,
          commissionValue: Number(commission.program.commissionValue),
          fixedValue: commission.program.fixedValue ? Number(commission.program.fixedValue) : null,
        },
        amount,
      )
    }

    const updated = await prisma.commission.update({
      where: { id },
      data: { amount, billJustification: amount === 0 ? justification : null, commissionValue, status: "PENDING" },
      include: { partner: { select: { id: true, name: true, email: true } }, promotion: { select: { id: true, title: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "Commission", entityId: id, details: { amount, commissionValue } })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
