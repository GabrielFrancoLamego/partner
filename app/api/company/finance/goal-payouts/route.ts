import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)

    const payouts = await prisma.goalPayout.findMany({
      where: { companyId: user.companyId },
      include: { goal: { select: { id: true, name: true } }, employee: { select: { id: true, name: true } }, paidBy: { select: { id: true, name: true } } },
      orderBy: { paidAt: "desc" },
      take: 200,
    })

    return Response.json(payouts)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Registro de Quitação — grava o pagamento de um bônus de meta batida e marca o saldo como Pago. */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const companyId = user.companyId

    const body = await request.json()
    const { goalId, employeeId, amount, rewardType, period, note } = body as {
      goalId: string
      employeeId: string
      amount: number
      rewardType?: "CASH" | "PHYSICAL_REWARD"
      period: string
      note?: string
    }

    if (!goalId || !employeeId) throw new ApiError(400, "Meta e colaborador são obrigatórios")
    if (!period?.trim()) throw new ApiError(400, "Informe a competência (AAAA-MM)")
    if (amount === undefined || Number.isNaN(Number(amount))) throw new ApiError(400, "Valor inválido")

    const goal = await prisma.goal.findFirst({ where: { id: goalId, companyId } })
    if (!goal) throw new ApiError(404, "Meta não encontrada")
    const employee = await prisma.user.findFirst({ where: { id: employeeId, companyId } })
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const payout = await prisma.goalPayout.create({
      data: {
        companyId,
        goalId,
        employeeId,
        amount: Number(amount),
        rewardType: rewardType === "PHYSICAL_REWARD" ? "PHYSICAL_REWARD" : "CASH",
        period: period.trim(),
        status: "PAID",
        paidById: user.id,
        note: note?.trim() || null,
      },
      include: { goal: { select: { id: true, name: true } }, employee: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "GoalPayout", entityId: payout.id, details: body })

    const rewardDescription =
      payout.rewardType === "CASH" ? Number(payout.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "um prêmio"
    await notifyUser({
      userId: employeeId,
      type: "BONUS_AWARDED",
      title: "Bônus de meta recebido!",
      message: `Você recebeu ${rewardDescription} pela meta "${payout.goal.name}" (${payout.period}).`,
      linkUrl: "/company/metas",
    }).catch(() => {})

    return Response.json(payout, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
