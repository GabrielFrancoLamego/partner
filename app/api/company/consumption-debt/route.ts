import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

/**
 * Conta de Consumo — saldo devedor acumulado (comandas assinadas na casa,
 * ver Occurrence.type = CONSUMO) e o extrato que formou esse saldo. Sem
 * `employeeId`, devolve a do próprio usuário logado (Colaborador OU Gerente,
 * ver User.consumptionDebt); com `employeeId`, só Gerente/Master podem ver a
 * de outra pessoa.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const requestedId = searchParams.get("employeeId")

    let targetId = user.id
    if (requestedId && requestedId !== user.id) {
      requireCapability(user, canManageDailyOperations)
      const target = await prisma.user.findFirst({ where: { id: requestedId, companyId } })
      if (!target) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
      targetId = requestedId
    }

    const [targetUser, entries] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: targetId }, select: { consumptionDebt: true } }),
      prisma.occurrence.findMany({
        where: {
          companyId,
          employeeId: targetId,
          OR: [{ type: "CONSUMO" }, { type: "PAGAMENTO_CONSUMO" }, { paymentMethod: "CONSUMO" }],
        },
        select: { id: true, type: true, total: true, paymentMethod: true, description: true, date: true, attachmentUrl: true },
        orderBy: { date: "desc" },
        take: 100,
      }),
    ])

    return Response.json({ debt: Number(targetUser.consumptionDebt), entries })
  } catch (error) {
    return handleApiError(error)
  }
}
