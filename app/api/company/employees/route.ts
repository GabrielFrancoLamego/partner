import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

/**
 * Lista colaboradores (role EMPLOYEE) da própria empresa — usado em seletores
 * das telas de RH/Ocorrências/Ponto. Gerente/Master recebem o pacote completo
 * (inclusive salário-base e permissão CREATE_ONLY); um colaborador autorizado
 * a só lançar Ocorrências (canRegisterOccurrences) recebe apenas id/nome —
 * dado sensível de colega (salário) nunca vaza para esse perfil.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const isManager = canManageDailyOperations(user.role)

    if (!isManager) {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { canRegisterOccurrences: true },
      })
      if (!profile?.canRegisterOccurrences) throw new ApiError(403, "Sem permissão para esta ação")
    }

    const employees = await prisma.user.findMany({
      where: { companyId: user.companyId, role: "EMPLOYEE", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        email: true,
        employeeProfile: { select: { canRegisterOccurrences: true, monthlySalary: true } },
      },
      orderBy: { name: "asc" },
    })

    if (!isManager) {
      return Response.json(employees.map((e) => ({ id: e.id, name: e.name })))
    }

    return Response.json(
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        canRegisterOccurrences: e.employeeProfile?.canRegisterOccurrences ?? false,
        monthlySalary: e.employeeProfile?.monthlySalary ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
