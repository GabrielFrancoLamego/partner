import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/** Concede/revoga permissão CREATE_ONLY de Ocorrências e ajusta salário-base (usado no abate automático de FALTA). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const employee = await prisma.user.findFirst({ where: { id, companyId, role: "EMPLOYEE" } })
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const body = await request.json()
    const { canRegisterOccurrences, monthlySalary } = body

    const updated = await prisma.employeeProfile.update({
      where: { userId: id },
      data: {
        ...(canRegisterOccurrences !== undefined ? { canRegisterOccurrences } : {}),
        ...(monthlySalary !== undefined ? { monthlySalary: monthlySalary === null ? null : Number(monthlySalary) } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "EmployeeProfile", entityId: updated.id, details: body })

    return Response.json({ id: employee.id, canRegisterOccurrences: updated.canRegisterOccurrences, monthlySalary: updated.monthlySalary })
  } catch (error) {
    return handleApiError(error)
  }
}
