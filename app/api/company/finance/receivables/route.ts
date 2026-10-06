import { handleApiError, requireFinanceContext } from "@/lib/api-auth"
import { listReceivables } from "@/lib/finance-reports"

/**
 * Recebíveis de Colaboradores — projeção financeira do mês por colaborador
 * (?month=AAAA-MM, padrão mês atual) com o detalhamento de cada provento e
 * desconto. Fica separado de Contas a Pagar. Novos pagamentos de Meta/Bônus/
 * Prêmio entram SOMENTE por Ocorrências e recalculam esta projeção sozinhos.
 */
export async function GET(request: Request) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)
    const { searchParams } = new URL(request.url)
    return Response.json(await listReceivables(scopeCompanyId, searchParams.get("month")))
  } catch (error) {
    return handleApiError(error)
  }
}
