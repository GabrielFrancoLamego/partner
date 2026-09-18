import "server-only"
import { prisma } from "./prisma"

/** Recalcula Company.avgRating/ratingCount a partir de CompanyRating — chamado a cada upsert de avaliação. */
export async function recomputeCompanyRating(companyId: string) {
  const agg = await prisma.companyRating.aggregate({
    where: { companyId },
    _avg: { stars: true },
    _count: true,
  })
  await prisma.company.update({
    where: { id: companyId },
    data: {
      avgRating: agg._count > 0 ? agg._avg.stars : null,
      ratingCount: agg._count,
    },
  })
}

/**
 * Empresas com Program ativo (ProgramMembership ACTIVE) para este parceiro
 * que ele ainda não avaliou — base do modal "Avaliação Rápida" exibido no
 * acesso ao /partner (ver components/partner/rating-prompt-modal.tsx). Uma
 * vez avaliada, a empresa não volta a aparecer aqui (sem re-prompt periódico).
 */
export async function getPendingRatingCompanies(partnerId: string) {
  const memberships = await prisma.programMembership.findMany({
    where: { partnerId, status: "ACTIVE" },
    select: { companyId: true },
    distinct: ["companyId"],
  })
  if (memberships.length === 0) return []

  const companyIds = memberships.map((m) => m.companyId)
  const rated = await prisma.companyRating.findMany({
    where: { partnerId, companyId: { in: companyIds } },
    select: { companyId: true },
  })
  const ratedIds = new Set(rated.map((r) => r.companyId))
  const pendingIds = companyIds.filter((id) => !ratedIds.has(id))
  if (pendingIds.length === 0) return []

  return prisma.company.findMany({
    where: { id: { in: pendingIds } },
    select: { id: true, name: true, profilePictureUrl: true },
  })
}
