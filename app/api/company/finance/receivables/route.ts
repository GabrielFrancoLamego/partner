import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { computeEmployeeFinance, parseMonth } from "@/lib/finance-employee"

/**
 * Recebíveis de Colaboradores — projeção financeira do mês por colaborador
 * (?month=AAAA-MM, padrão mês atual): Salário Fixo, Adiantamento do dia 20,
 * Taxa de Serviço, Metas/Premiações, descontos/consumo e Saldo Líquido
 * Restante. Cada linha traz os proventos pendentes (para pagar individualmente)
 * e o líquido (para "Pagar total líquido"). Fica separado de Contas a Pagar.
 * Novos pagamentos de Meta/Bônus/Prêmio entram por Ocorrências e recalculam
 * esta projeção automaticamente.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const month = parseMonth(searchParams.get("month")).key

    const employees = await prisma.user.findMany({
      where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
      select: { id: true },
      orderBy: { name: "asc" },
    })

    const rows = await Promise.all(employees.map((e) => computeEmployeeFinance(companyId, e.id, month, { ensurePayroll: true })))
    return Response.json({ month, rows: rows.filter((r) => r !== null) })
  } catch (error) {
    return handleApiError(error)
  }
}
