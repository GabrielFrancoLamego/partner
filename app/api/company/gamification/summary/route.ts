import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { resolveCareerProgress } from "@/lib/gamification"

/** Trilha de cargos + ranking da empresa; bloco `me` só para EMPLOYEE. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const [program, ranked] = await Promise.all([
      prisma.internalProgram.findUnique({ where: { companyId }, include: { levels: { orderBy: { order: "asc" } } } }),
      prisma.employeeProfile.findMany({
        where: { user: { companyId, role: "EMPLOYEE", status: "ACTIVE" } },
        select: { userId: true, xpPoints: true, currentInternalLevel: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { xpPoints: "desc" },
        take: 20,
      }),
    ])
    const levels = program?.levels ?? []

    const leaderboard = ranked.map((r, index) => ({
      rank: index + 1,
      employeeId: r.userId,
      name: r.user.name,
      xpPoints: r.xpPoints,
      levelName: r.currentInternalLevel?.name ?? levels[0]?.name ?? null,
    }))

    let me: ReturnType<typeof resolveCareerProgress> | null = null
    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { xpPoints: true, currentInternalLevelId: true },
      })
      me = resolveCareerProgress(profile?.xpPoints ?? 0, levels, profile?.currentInternalLevelId ?? null)
    }

    return Response.json({ levels, leaderboard, me })
  } catch (error) {
    return handleApiError(error)
  }
}
