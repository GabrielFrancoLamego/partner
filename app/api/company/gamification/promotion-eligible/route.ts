import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { monthsSince } from "@/lib/gamification"

/**
 * Colaboradores que já atingiram a pontuação do próximo cargo E cumpriram o
 * tempo mínimo de permanência no cargo atual (InternalLevelRule.minTenureMonths)
 * — ficam disponíveis para o Master clicar "Aplicar Promoção" (ver
 * POST .../promotion-eligible/[employeeId]/apply). Não inclui quem já tem uma
 * promoção pendente de aceite.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const program = await prisma.internalProgram.findUnique({
      where: { companyId },
      include: { levels: { orderBy: { order: "asc" } } },
    })
    const levels = program?.levels ?? []
    if (levels.length < 2) return Response.json([])

    const profiles = await prisma.employeeProfile.findMany({
      where: { user: { companyId, role: "EMPLOYEE", status: "ACTIVE" }, pendingPromotionLevelId: null },
      select: {
        userId: true,
        xpPoints: true,
        currentInternalLevelId: true,
        currentInternalLevelSince: true,
        user: { select: { name: true, createdAt: true } },
      },
    })

    const now = new Date()
    const eligible = profiles
      .map((p) => {
        const currentLevel = p.currentInternalLevelId ? levels.find((l) => l.id === p.currentInternalLevelId) : levels[0]
        if (!currentLevel) return null
        const nextLevel = levels.find((l) => l.order === currentLevel.order + 1)
        if (!nextLevel) return null

        const tenureStart = p.currentInternalLevelSince ?? p.user.createdAt
        const monthsInRole = monthsSince(tenureStart, now)
        const meetsScore = p.xpPoints >= nextLevel.pointsRequired
        const meetsTenure = currentLevel.minTenureMonths === 0 || monthsInRole >= currentLevel.minTenureMonths
        if (!meetsScore || !meetsTenure) return null

        return {
          employeeId: p.userId,
          name: p.user.name,
          currentLevelName: currentLevel.name,
          xpPoints: p.xpPoints,
          monthsInRole,
          nextLevel: { id: nextLevel.id, name: nextLevel.name, pointsRequired: nextLevel.pointsRequired },
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return Response.json(eligible)
  } catch (error) {
    return handleApiError(error)
  }
}
