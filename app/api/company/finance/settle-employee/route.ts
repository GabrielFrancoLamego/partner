import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { parsePaymentMethod, parseProofFile } from "@/lib/finance-settlement"
import { settleEmployeeNet } from "@/lib/finance-employee"

/**
 * "PAGAR TOTAL LÍQUIDO" do colaborador — multipart com `employeeId`, `month`
 * (AAAA-MM, opcional), `paymentMethod` (PIX | DINHEIRO | TRANSFERENCIA) e
 * `file` (comprovante, obrigatório).
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
    })
    return Response.json(settlement, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
