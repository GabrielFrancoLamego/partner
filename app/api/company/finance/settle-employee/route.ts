import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { parsePaymentMethod, parseProofFile } from "@/lib/finance-settlement"
import { settleEmployeeNet, type PaymentSelection } from "@/lib/finance-employee"

function parseSelection(raw: unknown): PaymentSelection | undefined {
  if (typeof raw !== "string" || !raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<PaymentSelection>
    const ids = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [])
    return { occurrenceIds: ids(parsed.occurrenceIds), goalPayoutIds: ids(parsed.goalPayoutIds), consumption: Boolean(parsed.consumption) }
  } catch {
    throw new ApiError(400, "Seleção de itens inválida")
  }
}

/**
 * Pagar o líquido de um colaborador — multipart com `employeeId`, `month`
 * (AAAA-MM, opcional), `paymentMethod` (PIX | DINHEIRO | TRANSFERENCIA) e
 * `file` (comprovante, obrigatório). Sem `selection` quita o TOTAL LÍQUIDO;
 * com `selection` (JSON {occurrenceIds, goalPayoutIds, consumption}) faz o
 * PAGAMENTO PARCIAL apenas dos itens marcados.
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)

    const form = await request.formData()
    const employeeId = form.get("employeeId")
    if (typeof employeeId !== "string" || !employeeId) throw new ApiError(400, "Colaborador não informado")
    const month = form.get("month")

    const settlement = await settleEmployeeNet({
      companyId: user.companyId,
      userId: user.id,
      employeeId,
      month: typeof month === "string" && month ? month : null,
      method: parsePaymentMethod(form.get("paymentMethod")),
      file: parseProofFile(form.get("file")),
      selection: parseSelection(form.get("selection")),
    })
    return Response.json(settlement, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
