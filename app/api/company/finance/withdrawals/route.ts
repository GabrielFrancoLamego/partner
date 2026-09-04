import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageFinance } from "@/lib/permissions"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageFinance)

    const withdrawals = await prisma.withdrawal.findMany({
      where: { companyId: user.companyId },
      include: { partner: { select: { id: true, name: true, email: true } } },
      orderBy: { requestDate: "desc" },
      take: 200,
    })

    return Response.json(withdrawals)
  } catch (error) {
    return handleApiError(error)
  }
}
