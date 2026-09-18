import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { getMonthlyScore, getServiceFeeAdjustment } from "@/lib/gamification"

/** Extrato de XP do mês corrente — usado no modal "Extrato Detalhado" do Dashboard do Colaborador. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [entries, monthlyScore, serviceFeeAdjustment, program] = await Promise.all([
      prisma.xpEntry.findMany({
        where: { companyId, employeeId: user.id, createdAt: { gte: startOfMonth } },
        orderBy: { createdAt: "desc" },
      }),
      getMonthlyScore(companyId, user.id, now),
      getServiceFeeAdjustment(companyId, user.id, now),
      prisma.internalProgram.findUnique({ where: { companyId }, select: { basePoints: true } }),
    ])

    return Response.json({ monthlyScore, basePoints: program?.basePoints ?? 100, entries, serviceFeeAdjustment })
  } catch (error) {
    return handleApiError(error)
  }
}
