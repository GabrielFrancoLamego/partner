import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { listPayables } from "@/lib/finance-reports"

/** Contas a Pagar — saques aprovados e favorecidos sem cadastro, em ordem de vencimento (ver lib/finance-reports.ts). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    return Response.json(await listPayables(user.companyId))
  } catch (error) {
    return handleApiError(error)
  }
}
