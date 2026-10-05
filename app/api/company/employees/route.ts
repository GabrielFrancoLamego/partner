import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { canManageOccurrences } from "@/lib/permissions"

/**
 * Lista colaboradores (role EMPLOYEE) da própria empresa — usado em seletores
 * das telas de RH/Ocorrências/Ponto/Comunicação. Gerente/Master/Financeiro
 * (canManageOccurrences) recebem o pacote completo (inclusive salário-base);
 * qualquer outro staff autenticado (ex: Colaborador escolhendo um colega pra
 * mandar uma Comunicação Interna) recebe só id/nome — dado sensível de colega
 * (salário) nunca vaza para esse perfil.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const isManager = canManageOccurrences(user.role)

    // ?status=ALL|INACTIVE devolve também colaboradores bloqueados (Diarista
    // pago / Temporário com contrato vencido) — necessário pra Gerente/Master
    // conseguirem encontrá-los e reativá-los (ver PATCH .../employees/[id]).
    // ?status=DELETION_REQUESTED lista quem pediu exclusão da conta, pro
    // Master decidir (arquivar via PATCH status=ARCHIVED).
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status")
    const statusWhere =
      statusParam === "ALL"
        ? {}
        : statusParam === "INACTIVE"
          ? { status: "INACTIVE" as const }
          : statusParam === "DELETION_REQUESTED"
            ? { accountDeletionStatus: "ACCOUNT_DELETION_REQUESTED" as const }
            : { status: "ACTIVE" as const }

    const employees = await prisma.user.findMany({
      where: { companyId: user.companyId, role: "EMPLOYEE", ...statusWhere },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        accountDeletionStatus: true,
        accountDeletionRequestedAt: true,
        accountDeletionReason: true,
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
            employmentType: true,
            contractStartDate: true,
            contractEndDate: true,
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
        status: e.status,
        accountDeletionStatus: e.accountDeletionStatus,
        accountDeletionRequestedAt: e.accountDeletionRequestedAt,
        accountDeletionReason: e.accountDeletionReason,
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
        employmentType: e.employeeProfile?.employmentType ?? "FIXO",
        contractStartDate: e.employeeProfile?.contractStartDate ?? null,
        contractEndDate: e.employeeProfile?.contractEndDate ?? null,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
