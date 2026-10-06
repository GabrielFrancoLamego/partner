import { handleApiError, requireFinanceContext } from "@/lib/api-auth"
import { computeFinanceSummary } from "@/lib/finance-reports"

/**
 * Contadores do módulo Financeiro. `total` (badge do menu lateral) é a SOMA
 * EXATA dos badges das abas: Contas a Pagar vencendo hoje + Saques aguardando
 * aprovação + Recebíveis vencendo hoje (ver computeFinanceSummary).
 */
export async function GET(request: Request) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)
    return Response.json(await computeFinanceSummary(scopeCompanyId))
  } catch (error) {
    return handleApiError(error)
  }
}
