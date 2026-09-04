import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

/** Lista colaboradores (role EMPLOYEE) da própria empresa — usado em seletores das telas de RH/Ocorrências/Ponto. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)

    const employees = await prisma.user.findMany({
      where: { companyId: user.companyId, role: "EMPLOYEE", status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    })

    return Response.json(employees)
  } catch (error) {
    return handleApiError(error)
  }
}
