import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"

/**
 * Registro de Quitação — extrato de tudo que foi marcado como pago (Contas a
 * Pagar e Recebíveis), do mais recente ao mais antigo. Filtros opcionais
 * ?from=AAAA-MM-DD&to=AAAA-MM-DD sobre a data do pagamento.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const paidAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    }

    const settlements = await prisma.financialSettlement.findMany({
      where: { companyId: user.companyId, ...(from || to ? { paidAt } : {}) },
      include: { paidBy: { select: { id: true, name: true } } },
      orderBy: { paidAt: "desc" },
      take: 500,
    })

    return Response.json(settlements.map((s) => ({ ...s, amount: Number(s.amount) })))
  } catch (error) {
    return handleApiError(error)
  }
}
