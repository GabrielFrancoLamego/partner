import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { sweepInactiveMemberships } from "@/lib/program-lifecycle"
import { ensureMonthlyPerformanceNotification } from "@/lib/partner-lifecycle"

/**
 * Painel do parceiro: saldo em carteira, régua de nível (todos os níveis do
 * mesmo Program do nível atual, para desenhar a trilha Prata->Ouro->Diamante),
 * comissões pendentes/aprovadas e as indicações mais recentes.
 */
export async function GET() {
  try {
    const user = await requirePartner()

    // Sem infra de cron (ver lib/license-exemption.ts) — varreduras preguiçosas
    // disparadas no acesso ao dashboard, o ponto de entrada mais frequente do parceiro.
    await sweepInactiveMemberships()
    await ensureMonthlyPerformanceNotification(user.id)

    const profile = await prisma.partnerProfile.findUnique({
      where: { userId: user.id },
      include: { currentLevel: { include: { program: { include: { levels: { orderBy: { order: "asc" } } } } } } },
    })
    if (!profile) throw new ApiError(404, "Perfil de parceiro não encontrado")

    const [pendingAgg, approvedAgg, paidAgg, recentCommissions, qualifyingCount] = await Promise.all([
      prisma.commission.aggregate({
        where: { partnerId: user.id, status: { in: ["PENDING", "AWAITING_VALUE"] } },
        _sum: { commissionValue: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { partnerId: user.id, status: "APPROVED" },
        _sum: { commissionValue: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { partnerId: user.id, status: "PAID" },
        _sum: { commissionValue: true },
        _count: true,
      }),
      prisma.commission.findMany({
        where: { partnerId: user.id },
        include: { company: { select: { name: true } }, promotion: { select: { title: true } } },
        orderBy: { date: "desc" },
        take: 10,
      }),
      prisma.commission.count({ where: { partnerId: user.id, status: { in: ["APPROVED", "PAID"] } } }),
    ])

    const levels = profile.currentLevel?.program.levels ?? []
    const currentOrder = profile.currentLevel?.order ?? -1
    const nextLevel = levels.find((l) => l.order > currentOrder) ?? null

    return Response.json({
      walletBalance: Number(profile.walletBalance),
      bankData: {
        pixKey: profile.pixKey,
        bankName: profile.bankName,
        accountType: profile.accountType,
        agency: profile.agency,
        accountNumber: profile.accountNumber,
        isComplete: Boolean(profile.pixKey && profile.bankName && profile.agency && profile.accountNumber),
      },
      currentLevel: profile.currentLevel
        ? {
            id: profile.currentLevel.id,
            name: profile.currentLevel.name,
            order: profile.currentLevel.order,
            badgeColorHex: profile.currentLevel.badgeColorHex,
            medalIcon: profile.currentLevel.medalIcon,
            imageUrl: profile.currentLevel.imageUrl,
            commissionPercentage: Number(profile.currentLevel.commissionPercentage),
            bonusDescription: profile.currentLevel.bonusDescription,
          }
        : null,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            order: nextLevel.order,
            requiredReferralCount: nextLevel.requiredReferralCount,
            requiredRevenueAmount: nextLevel.requiredRevenueAmount ? Number(nextLevel.requiredRevenueAmount) : null,
            criteria: nextLevel.criteria,
            badgeColorHex: nextLevel.badgeColorHex,
            medalIcon: nextLevel.medalIcon,
            imageUrl: nextLevel.imageUrl,
          }
        : null,
      levels: levels.map((l) => ({
        id: l.id,
        name: l.name,
        order: l.order,
        badgeColorHex: l.badgeColorHex,
        medalIcon: l.medalIcon,
        imageUrl: l.imageUrl,
      })),
      qualifyingCount,
      commissions: {
        pending: { total: Number(pendingAgg._sum.commissionValue ?? 0), count: pendingAgg._count },
        approved: { total: Number(approvedAgg._sum.commissionValue ?? 0), count: approvedAgg._count },
        paid: { total: Number(paidAgg._sum.commissionValue ?? 0), count: paidAgg._count },
      },
      recentCommissions,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
