import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { computeFinanceSummary } from "@/lib/finance-reports"

/**
 * Contadores do módulo Financeiro. `total` (badge do menu lateral) é a SOMA
 * EXATA dos badges das abas: Contas a Pagar vencendo hoje + Saques aguardando
 * aprovação + Recebíveis vencendo hoje (ver computeFinanceSummary).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    return Response.json(await computeFinanceSummary(user.companyId))
  } catch (error) {
    return handleApiError(error)
  }
}
