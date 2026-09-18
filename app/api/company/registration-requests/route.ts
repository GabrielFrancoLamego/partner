import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageCompanyUsers } from "@/lib/permissions"

/** Fila de aprovações pendentes da própria empresa — visível ao Master (mesmo papel que cadastra Gerente/Financeiro). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageCompanyUsers)

    const requests = await prisma.publicRegistrationRequest.findMany({
      where: { companyId: user.companyId, status: "PENDING_APPROVAL" },
      include: { sector: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(requests)
  } catch (error) {
    return handleApiError(error)
  }
}
