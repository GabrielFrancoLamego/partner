import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"

/**
 * Pop-up animado de +XX/-XX ao entrar no app: soma os lançamentos de XP desde
 * a última visita (EmployeeProfile.lastXpSeenAt) e já marca como vista nesta
 * mesma chamada — chamado uma única vez ao montar o Dashboard do Colaborador,
 * separado da rota de dashboard (que é refeita a cada troca de filtro).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    if (user.role !== "EMPLOYEE") return Response.json({ delta: 0, entries: [] })

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { lastXpSeenAt: true } })
    if (!profile) throw new ApiError(404, "Perfil de colaborador não encontrado")

    const since = profile.lastXpSeenAt ?? new Date(0)

    const entries = await prisma.xpEntry.findMany({
      where: { employeeId: user.id, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    await prisma.employeeProfile.update({ where: { userId: user.id }, data: { lastXpSeenAt: new Date() } })

    return Response.json({
      delta: entries.reduce((sum, e) => sum + e.points, 0),
      entries,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
