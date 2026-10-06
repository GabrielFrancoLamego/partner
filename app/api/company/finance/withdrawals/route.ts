import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)

    const withdrawals = await prisma.withdrawal.findMany({
      where: { companyId: user.companyId },
      include: { partner: { select: { id: true, name: true, email: true, partnerProfile: { select: { fullName: true, cpf: true, document: true } } } } },
      orderBy: { requestDate: "desc" },
      take: 200,
    })

    return Response.json(withdrawals)
  } catch (error) {
    return handleApiError(error)
  }
}
