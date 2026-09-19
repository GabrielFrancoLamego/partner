import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/**
 * Passo 1 da sequência obrigatória de fechamento — confirma/lança o Valor
 * Total da Conta de uma indicação do dia que ainda não tinha `amount`
 * preenchido (normalmente só acontece com registros antigos, já que o
 * Scanner PDV agora exige o valor no momento do registro). Gerente/Master
 * (não exige a capability de Financeiro — é só o valor da conta, não aprovação).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const commission = await prisma.commission.findFirst({ where: { id, companyId } })
    if (!commission) throw new ApiError(404, "Comissão não encontrada")

    const body = await request.json()
    const { amount, billJustification } = body as { amount: number; billJustification?: string }

    const amountNumber = Number(amount)
    if (Number.isNaN(amountNumber) || amountNumber < 0) throw new ApiError(400, "Valor da conta inválido")
    const justification = billJustification?.trim() ?? ""
    if (amountNumber === 0 && !justification) {
      throw new ApiError(400, "Conta com valor R$ 0,00 exige justificativa")
    }

    const updated = await prisma.commission.update({
      where: { id },
      data: { amount: amountNumber, billJustification: amountNumber === 0 ? justification : null },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "Commission", entityId: id, details: { amount: amountNumber } })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
