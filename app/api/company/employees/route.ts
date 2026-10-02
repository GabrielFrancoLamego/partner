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
        employeeProfile: {
          select: {
            canRegisterOccurrences: true,
            monthlySalary: true,
            sectorId: true,
            sector: { select: { id: true, name: true } },
            tag: true,
            shiftType: true,
            workStartTime: true,
            workEndTime: true,
            breakStartTime: true,
            breakEndTime: true,
            dailyBreakAllowanceMinutes: true,
            bankOfHoursMinutes: true,
            weeklySchedule: true,
            weeklyDayOff: true,
            hasExtraMonthlyDayOff: true,
            isFinanceResponsible: true,
            isSectorCommunicationResponsible: true,
            xpPoints: true,
            currentInternalLevel: { select: { id: true, name: true } },
          },
        },
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
        sectorId: e.employeeProfile?.sectorId ?? null,
        sector: e.employeeProfile?.sector ?? null,
        tag: e.employeeProfile?.tag ?? null,
        shiftType: e.employeeProfile?.shiftType ?? null,
        workStartTime: e.employeeProfile?.workStartTime ?? null,
        workEndTime: e.employeeProfile?.workEndTime ?? null,
        breakStartTime: e.employeeProfile?.breakStartTime ?? null,
        breakEndTime: e.employeeProfile?.breakEndTime ?? null,
        dailyBreakAllowanceMinutes: e.employeeProfile?.dailyBreakAllowanceMinutes ?? 60,
        bankOfHoursMinutes: e.employeeProfile?.bankOfHoursMinutes ?? 0,
        weeklySchedule: e.employeeProfile?.weeklySchedule ?? null,
        weeklyDayOff: e.employeeProfile?.weeklyDayOff ?? null,
        hasExtraMonthlyDayOff: e.employeeProfile?.hasExtraMonthlyDayOff ?? false,
        isFinanceResponsible: e.employeeProfile?.isFinanceResponsible ?? false,
        isSectorCommunicationResponsible: e.employeeProfile?.isSectorCommunicationResponsible ?? false,
        xpPoints: e.employeeProfile?.xpPoints ?? 0,
        currentLevel: e.employeeProfile?.currentInternalLevel ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
