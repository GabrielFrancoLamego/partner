import "server-only"
import { prisma } from "./prisma"
import { currentPeriodWindow } from "./goal-period"
import { notifyUser } from "./notifications"

function monthPeriodLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Chamado depois de qualquer gravação de GoalRecord (lançamento manual em
 * POST /api/company/goals/[id]/records OU sincronização automática do
 * fechamento de caixa em POST /api/company/shift-closing) — confere se a
 * meta acabou de bater uma NOVA faixa (comparando com o que já foi
 * distribuído em GoalPayout para esse goalId+tierId+período, idempotente) e,
 * se sim, distribui o prêmio da equipe:
 *   1. Público: colaboradores presentes hoje (TimeEntry CHECK_IN), filtrados
 *      pelo escopo da meta (COMPANY = todos, SECTOR = só o setor, EMPLOYEE =
 *      só o colaborador-alvo, presente ou não).
 *   2. Credita na "carteira digital" via GoalPayout (status PAID) — mesma
 *      tabela/fluxo já usado no lançamento manual de
 *      app/api/company/finance/goal-payouts.
 *   3. Registra a Occurrence automática (type=META) espelhada, ligada ao
 *      GoalPayout via occurrenceId — excluir essa Occurrence estorna o
 *      GoalPayout (ver DELETE /api/company/occurrences/[id]).
 *   4. Notifica cada colaborador (type=BONUS_AWARDED) — dispara o som +
 *      animação de chuva de moedas (ver components/notifications/notification-bell.tsx).
 */
export async function maybeDistributeGoalReward(goalId: string, companyId: string, triggeredById: string) {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: { tiers: { orderBy: { order: "asc" } } },
  })
  if (!goal || !goal.active || goal.tiers.length === 0) return

  const window = currentPeriodWindow(goal.period)
  const agg = await prisma.goalRecord.aggregate({
    where: { goalId, date: { gte: window.start, lt: window.end } },
    _sum: { amount: true },
  })
  const currentAmount = Number(agg._sum.amount ?? 0)

  const sortedTiers = [...goal.tiers].sort((a, b) => Number(a.targetAmount) - Number(b.targetAmount))
  let reachedTier: (typeof sortedTiers)[number] | null = null
  for (const tier of sortedTiers) {
    if (currentAmount >= Number(tier.targetAmount)) reachedTier = tier
  }
  if (!reachedTier) return

  const period = monthPeriodLabel(window.start)
  const alreadyDistributed = await prisma.goalPayout.findFirst({
    where: { goalId, goalTierId: reachedTier.id, period },
  })
  if (alreadyDistributed) return

  let recipients: { id: string; name: string }[] = []
  if (goal.scope === "EMPLOYEE" && goal.employeeId) {
    const employee = await prisma.user.findUnique({ where: { id: goal.employeeId }, select: { id: true, name: true } })
    if (employee) recipients = [employee]
  } else {
    const presentIds = await prisma.timeEntry.findMany({
      where: { companyId, type: "CHECK_IN", createdAt: { gte: startOfDay(new Date()) } },
      select: { userId: true },
      distinct: ["userId"],
    })
    recipients = await prisma.user.findMany({
      where: {
        id: { in: presentIds.map((p) => p.userId) },
        companyId,
        role: "EMPLOYEE",
        ...(goal.scope === "SECTOR" && goal.sectorId ? { employeeProfile: { sectorId: goal.sectorId } } : {}),
      },
      select: { id: true, name: true },
    })
  }
  if (recipients.length === 0) return

  const isCash = reachedTier.rewardType === "CASH"
  const rewardAmount = isCash ? Number(reachedTier.bonusAmount) : 0
  const rewardLabel = isCash
    ? rewardAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : reachedTier.rewardLabel ?? "um prêmio"

  for (const employee of recipients) {
    try {
      await prisma.$transaction(async (tx) => {
        const occurrence = await tx.occurrence.create({
          data: {
            companyId,
            employeeId: employee.id,
            type: "META",
            date: new Date(),
            value: isCash ? rewardAmount : null,
            quantity: 1,
            total: isCash ? rewardAmount : null,
            paymentStatus: "PAID",
            description: `Meta "${goal.name}" batida — prêmio de equipe (${rewardLabel})`,
            createdById: triggeredById,
          },
        })
        await tx.goalPayout.create({
          data: {
            companyId,
            goalId: goal.id,
            goalTierId: reachedTier.id,
            employeeId: employee.id,
            period,
            amount: rewardAmount,
            rewardType: reachedTier.rewardType,
            status: "PAID",
            paidById: triggeredById,
            note: "Distribuição automática — meta de equipe batida",
            occurrenceId: occurrence.id,
          },
        })
      })
    } catch {
      // Corrida rara (dupla chamada concorrente) colidindo com a constraint
      // única de goalId+goalTierId+employeeId+período — já foi distribuído
      // pra este colaborador, segue pro próximo sem quebrar o restante do lote.
      continue
    }

    await notifyUser({
      userId: employee.id,
      type: "BONUS_AWARDED",
      title: "Meta batida — prêmio recebido!",
      message: `A equipe bateu a meta "${goal.name}" e você recebeu ${rewardLabel}!`,
      linkUrl: "/company/metas",
    }).catch(() => {})
  }
}
