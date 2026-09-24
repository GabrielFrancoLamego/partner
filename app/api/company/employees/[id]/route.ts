import type { ShiftType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/** Ajustes de RH do colaborador: CREATE_ONLY de Ocorrências, salário-base, setor e turno/horário de trabalho. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const employee = await prisma.user.findFirst({ where: { id, companyId, role: "EMPLOYEE" } })
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const body = await request.json()
    const {
      canRegisterOccurrences,
      monthlySalary,
      sectorId,
      shiftType,
      workStartTime,
      workEndTime,
      breakStartTime,
      breakEndTime,
      dailyBreakAllowanceMinutes,
    } = body

    if (sectorId) {
      const sector = await prisma.sector.findFirst({ where: { id: sectorId, companyId } })
      if (!sector) throw new ApiError(404, "Setor não encontrado nesta empresa")
    }
    if (shiftType && shiftType !== "DAY" && shiftType !== "NIGHT") throw new ApiError(400, "Turno inválido")

    const updated = await prisma.employeeProfile.update({
      where: { userId: id },
      data: {
        ...(canRegisterOccurrences !== undefined ? { canRegisterOccurrences } : {}),
        ...(monthlySalary !== undefined ? { monthlySalary: monthlySalary === null ? null : Number(monthlySalary) } : {}),
        ...(sectorId !== undefined ? { sectorId: sectorId || null } : {}),
        ...(shiftType !== undefined ? { shiftType: (shiftType as ShiftType) || null } : {}),
        ...(workStartTime !== undefined ? { workStartTime: workStartTime || null } : {}),
        ...(workEndTime !== undefined ? { workEndTime: workEndTime || null } : {}),
        ...(breakStartTime !== undefined ? { breakStartTime: breakStartTime || null } : {}),
        ...(breakEndTime !== undefined ? { breakEndTime: breakEndTime || null } : {}),
        ...(dailyBreakAllowanceMinutes !== undefined ? { dailyBreakAllowanceMinutes: Number(dailyBreakAllowanceMinutes) || 0 } : {}),
      },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "EmployeeProfile", entityId: updated.id, details: body })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
