import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

/** Gerente/Master veem todos os resgates da empresa; Colaborador vê só os próprios. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const isManager = canManageDailyOperations(user.role)

    const redemptions = await prisma.rewardRedemption.findMany({
      where: { companyId: user.companyId, ...(isManager ? {} : { employeeId: user.id }) },
      include: {
        item: { select: { id: true, name: true, imageUrl: true } },
        employee: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return Response.json(redemptions)
  } catch (error) {
    return handleApiError(error)
  }
}
