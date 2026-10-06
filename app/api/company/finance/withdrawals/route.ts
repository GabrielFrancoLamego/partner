import { handleApiError, requireFinanceContext } from "@/lib/api-auth"
import { listWithdrawals } from "@/lib/finance-reports"

export async function GET(request: Request) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)
    return Response.json(await listWithdrawals(scopeCompanyId))
  } catch (error) {
    return handleApiError(error)
  }
}
