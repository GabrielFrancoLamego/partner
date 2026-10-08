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

    const levelOf = (r: (typeof ranked)[number]) => r.currentInternalLevel?.name ?? levels[0]?.name ?? null
    // Colaborador comum vê o PÓDIO (3 primeiros, só o primeiro nome) e a própria posição — nunca
    // id, sobrenome nem Pts dos colegas. Gestão (Master/Gerente/Admin) mantém o ranking completo.
    const leaderboard =
      user.role === "EMPLOYEE"
        ? ranked.map((r, index) => ({
            rank: index + 1,
            isMe: r.userId === user.id,
            displayName: r.userId === user.id ? r.user.name : index < 3 ? r.user.name.split(" ")[0] : null,
            xpPoints: r.userId === user.id ? r.xpPoints : null,
            levelName: levelOf(r),
          }))
        : ranked.map((r, index) => ({
            rank: index + 1,
            employeeId: r.userId,
            name: r.user.name,
            xpPoints: r.xpPoints,
            levelName: levelOf(r),
          }))

    let myRank: number | null = null
    let me: (ReturnType<typeof resolveCareerProgress> & { pendingPromotionLevel: { id: string; name: string } | null }) | null = null
    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { xpPoints: true, currentInternalLevelId: true, pendingPromotionLevel: { select: { id: true, name: true } } },
      })
      me = {
        ...resolveCareerProgress(profile?.xpPoints ?? 0, levels, profile?.currentInternalLevelId ?? null),
        pendingPromotionLevel: profile?.pendingPromotionLevel ?? null,
      }
      // Posição real mesmo fora do top 20 do ranking carregado.
      const ahead = await prisma.employeeProfile.count({
        where: { user: { companyId, role: "EMPLOYEE", status: "ACTIVE" }, xpPoints: { gt: profile?.xpPoints ?? 0 } },
      })
      myRank = ahead + 1
    }

    return Response.json({ levels, leaderboard, me, myRank })
  } catch (error) {
    return handleApiError(error)
  }
}
