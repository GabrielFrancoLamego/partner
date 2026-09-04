import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { resolveCareerProgress } from "@/lib/gamification"

/** Trilha de cargos + ranking da empresa; bloco `me` só para EMPLOYEE. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const [levels, ranked] = await Promise.all([
      prisma.careerLevel.findMany({ where: { companyId }, orderBy: { order: "asc" } }),
      prisma.employeeProfile.findMany({
        where: { user: { companyId, role: "EMPLOYEE", status: "ACTIVE" } },
        select: { userId: true, xpPoints: true, user: { select: { name: true } } },
        orderBy: { xpPoints: "desc" },
        take: 20,
      }),
    ])

    const leaderboard = ranked.map((r, index) => ({
      rank: index + 1,
      employeeId: r.userId,
      name: r.user.name,
      xpPoints: r.xpPoints,
    }))

    let me: ReturnType<typeof resolveCareerProgress> | null = null
    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { xpPoints: true } })
      me = resolveCareerProgress(profile?.xpPoints ?? 0, levels)
    }

    return Response.json({ levels, leaderboard, me })
  } catch (error) {
    return handleApiError(error)
  }
}
