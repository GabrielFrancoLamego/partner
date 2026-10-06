import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { listSettlements } from "@/lib/finance-reports"

/**
 * Registro de Quitação — extrato de tudo que foi marcado como pago (Contas a
 * Pagar e Recebíveis), do mais recente ao mais antigo. Filtros
 * ?from=AAAA-MM-DD&to=AAAA-MM-DD sobre a data do pagamento.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const { searchParams } = new URL(request.url)
    return Response.json(await listSettlements(user.companyId, searchParams.get("from"), searchParams.get("to")))
  } catch (error) {
    return handleApiError(error)
  }
}
