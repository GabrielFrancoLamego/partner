import "server-only"
import { prisma } from "./prisma"

/**
 * Nível do parceiro calculado INDIVIDUALMENTE por Programa (Ouro na Nomad's
 * Jeri, Bronze na Nomad's Lagoa etc.) — diferente do ponteiro único e global
 * PartnerProfile.currentLevelId (legado, nunca teve uma rotina automática de
 * promoção/rebaixamento real no código). Critério: indicações e/ou
 * faturamento (Valor da Conta) já APROVADOS/PAGOS naquela empresa, contra a
 * régua de ProgramLevel do respectivo Program.
 */
export type PartnerProgramLevelProgress = {
  programId: string
  programName: string
  companyId: string
  companyName: string
  companyLogoUrl: string | null
  referralCount: number
  revenue: number
  currentLevel: {
    id: string
    name: string
    order: number
    badgeColorHex: string
    medalIcon: string
    imageUrl: string | null
    commissionPercentage: number
  } | null
  nextLevel: {
    id: string
    name: string
    order: number
    requiredReferralCount: number
    requiredRevenueAmount: number | null
    criteria: "REFERRAL_COUNT" | "REVENUE" | "BOTH"
  } | null
  progressPercent: number
}

function meetsLevel(
  level: { criteria: string; requiredReferralCount: number; requiredRevenueAmount: unknown },
  referralCount: number,
  revenue: number,
) {
  const meetsCount = referralCount >= level.requiredReferralCount
  const meetsRevenue = level.requiredRevenueAmount === null || revenue >= Number(level.requiredRevenueAmount)
  if (level.criteria === "REFERRAL_COUNT") return meetsCount
  if (level.criteria === "REVENUE") return meetsRevenue
  return meetsCount && meetsRevenue // BOTH
}

export async function computePartnerProgramLevels(partnerId: string): Promise<PartnerProgramLevelProgress[]> {
  const memberships = await prisma.programMembership.findMany({
    where: { partnerId, status: "ACTIVE" },
    include: {
      program: {
        include: {
          company: { select: { id: true, name: true, profilePictureUrl: true } },
          levels: { orderBy: { order: "asc" } },
        },
      },
    },
  })
  if (memberships.length === 0) return []

  const companyIds = memberships.map((m) => m.companyId)
  const stats = await prisma.commission.groupBy({
    by: ["companyId"],
    where: { partnerId, companyId: { in: companyIds }, status: { in: ["APPROVED", "PAID"] } },
    _count: { _all: true },
    _sum: { amount: true },
  })
  const statsByCompany = new Map(stats.map((s) => [s.companyId, { count: s._count._all, revenue: Number(s._sum.amount ?? 0) }]))

  return memberships.map((m) => {
    const { count: referralCount, revenue } = statsByCompany.get(m.companyId) ?? { count: 0, revenue: 0 }
    const levels = m.program.levels

    let currentLevel: (typeof levels)[number] | null = null
    for (const level of levels) {
      if (meetsLevel(level, referralCount, revenue)) currentLevel = level
      else break
    }
    const nextLevel = levels.find((l) => l.order > (currentLevel?.order ?? -1)) ?? null

    let progressPercent = 100
    if (nextLevel) {
      const countRatio = nextLevel.requiredReferralCount > 0 ? referralCount / nextLevel.requiredReferralCount : 1
      const revenueRatio = nextLevel.requiredRevenueAmount ? revenue / Number(nextLevel.requiredRevenueAmount) : 1
      const ratio =
        nextLevel.criteria === "REFERRAL_COUNT" ? countRatio : nextLevel.criteria === "REVENUE" ? revenueRatio : Math.min(countRatio, revenueRatio)
      progressPercent = Math.max(0, Math.min(100, Math.round(ratio * 100)))
    }

    return {
      programId: m.programId,
      programName: m.program.name,
      companyId: m.companyId,
      companyName: m.program.company.name,
      companyLogoUrl: m.program.company.profilePictureUrl,
      referralCount,
      revenue,
      currentLevel: currentLevel
        ? {
            id: currentLevel.id,
            name: currentLevel.name,
            order: currentLevel.order,
            badgeColorHex: currentLevel.badgeColorHex,
            medalIcon: currentLevel.medalIcon,
            imageUrl: currentLevel.imageUrl,
            commissionPercentage: Number(currentLevel.commissionPercentage),
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
          }
        : null,
      progressPercent,
    }
  })
}
