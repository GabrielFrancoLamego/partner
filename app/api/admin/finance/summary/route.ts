import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const companyWhere = companyId && companyId !== "all" ? { companyId } : {}

    const [pendingCommissions, paidWithdrawals, pendingWithdrawals, deniedWithdrawals] = await Promise.all([
      prisma.commission.aggregate({
        where: { ...companyWhere, status: { in: ["PENDING", "AWAITING_VALUE"] } },
        _sum: { commissionValue: true },
        _count: true,
      }),
      prisma.withdrawal.aggregate({
        where: { ...companyWhere, status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.withdrawal.aggregate({
        where: { ...companyWhere, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.withdrawal.aggregate({
        where: { ...companyWhere, status: "REJECTED" },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    return Response.json({
      pendingCommissions: {
        total: Number(pendingCommissions._sum.commissionValue ?? 0),
        count: pendingCommissions._count,
      },
      withdrawalsPaid: { total: Number(paidWithdrawals._sum.amount ?? 0), count: paidWithdrawals._count },
      withdrawalsPending: { total: Number(pendingWithdrawals._sum.amount ?? 0), count: pendingWithdrawals._count },
      withdrawalsDenied: { total: Number(deniedWithdrawals._sum.amount ?? 0), count: deniedWithdrawals._count },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
