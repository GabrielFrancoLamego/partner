import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageFinance } from "@/lib/permissions"

export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageFinance)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const commissions = await prisma.commission.findMany({
      where: {
        companyId: user.companyId,
        ...(status && status !== "all" ? { status: status as "AWAITING_VALUE" | "PENDING" | "APPROVED" | "PAID" | "REJECTED" } : {}),
      },
      include: {
        partner: { select: { id: true, name: true, email: true } },
        promotion: { select: { id: true, title: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    })

    return Response.json(commissions)
  } catch (error) {
    return handleApiError(error)
  }
}
