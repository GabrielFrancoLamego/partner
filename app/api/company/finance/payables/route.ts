import { handleApiError, requireFinanceContext } from "@/lib/api-auth"
import { listPayables } from "@/lib/finance-reports"

/** Contas a Pagar — saques aprovados e favorecidos sem cadastro, em ordem de vencimento (ver lib/finance-reports.ts). */
export async function GET(request: Request) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)
    return Response.json(await listPayables(scopeCompanyId))
  } catch (error) {
    return handleApiError(error)
  }
}
