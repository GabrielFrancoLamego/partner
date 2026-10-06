import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { parsePaymentMethod, parseProofFile, settleGoalPayout, settleOccurrence, settleWithdrawal } from "@/lib/finance-settlement"

/**
 * Pagar um compromisso (botão "Pagar") — multipart com `kind`
 * (WITHDRAWAL | OCCURRENCE | GOAL_PAYOUT), `id`, `paymentMethod`
 * (PIX | DINHEIRO | TRANSFERENCIA | CONSUMO) e `file` (comprovante PNG/JPG/PDF,
 * obrigatório). Move o item para o Registro de Quitação (FinancialSettlement).
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)

    const form = await request.formData()
    const kind = form.get("kind")
    const id = form.get("id")
    if (typeof id !== "string" || !id) throw new ApiError(400, "Item a pagar não informado")

    const method = parsePaymentMethod(form.get("paymentMethod"))
    const file = parseProofFile(form.get("file"))
    const base = { companyId: user.companyId, userId: user.id, method, file }

    if (kind === "WITHDRAWAL") return Response.json(await settleWithdrawal({ ...base, withdrawalId: id }), { status: 201 })
    if (kind === "OCCURRENCE") return Response.json(await settleOccurrence({ ...base, occurrenceId: id }), { status: 201 })
    if (kind === "GOAL_PAYOUT") return Response.json(await settleGoalPayout({ ...base, goalPayoutId: id }), { status: 201 })
    throw new ApiError(400, "Tipo de compromisso inválido")
  } catch (error) {
    return handleApiError(error)
  }
}
