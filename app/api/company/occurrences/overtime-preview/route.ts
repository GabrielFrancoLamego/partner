import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { computeOvertimePreview } from "@/lib/payroll"

/**
 * Prévia do valor de Horas Extras ANTES de lançar a ocorrência — mostra pra
 * Gerente o cálculo (hora do próprio colaborador × horas × 1,5) pra ela
 * decidir se aplica, e com qual forma de pagamento (ver POST /api/company/occurrences).
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const hours = Number(searchParams.get("hours"))

    if (!employeeId) throw new ApiError(400, "Selecione o colaborador")

    const employee = await prisma.user.findFirst({
      where: { id: employeeId, companyId, role: "EMPLOYEE" },
      select: { employeeProfile: { select: { workStartTime: true, workEndTime: true, dailyBreakAllowanceMinutes: true, weeklyDayOff: true, monthlySalary: true } } },
    })
    if (!employee?.employeeProfile) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    try {
      const preview = computeOvertimePreview(
        {
          workStartTime: employee.employeeProfile.workStartTime,
          workEndTime: employee.employeeProfile.workEndTime,
          dailyBreakAllowanceMinutes: employee.employeeProfile.dailyBreakAllowanceMinutes,
          weeklyDayOff: employee.employeeProfile.weeklyDayOff,
          monthlySalary: employee.employeeProfile.monthlySalary ? Number(employee.employeeProfile.monthlySalary) : null,
        },
        hours,
      )
      return Response.json(preview)
    } catch (e) {
      throw new ApiError(400, e instanceof Error ? e.message : "Não foi possível calcular")
    }
  } catch (error) {
    return handleApiError(error)
  }
}
