import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { listWithdrawals } from "@/lib/finance-reports"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    return Response.json(await listWithdrawals(user.companyId))
  } catch (error) {
    return handleApiError(error)
  }
}
