import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"

/** Visão do colaborador: nota do dia, histórico e médias quinzenal/mensal. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [today, fortnight, month, history] = await Promise.all([
      prisma.dailyEvaluation.findFirst({
        where: { employeeId: user.id, date: startOfToday },
        include: { evaluatedBy: { select: { name: true } } },
      }),
      prisma.dailyEvaluation.aggregate({
        where: { employeeId: user.id, date: { gte: fifteenDaysAgo } },
        _avg: { score: true },
        _count: true,
      }),
      prisma.dailyEvaluation.aggregate({
        where: { employeeId: user.id, date: { gte: thirtyDaysAgo } },
        _avg: { score: true },
        _count: true,
      }),
      prisma.dailyEvaluation.findMany({
        where: { employeeId: user.id, date: { gte: thirtyDaysAgo } },
        include: { evaluatedBy: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 30,
      }),
    ])

    return Response.json({
      today,
      fortnightAverage: Number(fortnight._avg.score ?? 0),
      fortnightCount: fortnight._count,
      monthAverage: Number(month._avg.score ?? 0),
      monthCount: month._count,
      history,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
