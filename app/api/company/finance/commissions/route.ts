import { prisma } from "@/lib/prisma"
import { handleApiError, requireFinanceContext } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    // ?pending=1 → só o que exige ação do Financeiro: valor da conta a lançar ou comissão a aprovar.
    const onlyPending = searchParams.get("pending") === "1"

    const commissions = await prisma.commission.findMany({
      where: {
        companyId: scopeCompanyId,
        ...(onlyPending ? { OR: [{ amount: null }, { status: { in: ["AWAITING_VALUE", "PENDING"] } }] } : {}),
        ...(status && status !== "all" ? { status: status as "AWAITING_VALUE" | "PENDING" | "APPROVED" | "PAID" | "REJECTED" } : {}),
      },
      include: {
        partner: { select: { id: true, name: true, email: true } },
        promotion: { select: { id: true, title: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    })

    return Response.json(commissions)
  } catch (error) {
    return handleApiError(error)
  }
}
