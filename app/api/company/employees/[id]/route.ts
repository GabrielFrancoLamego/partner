import type { ShiftType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Ficha do colaborador — extrato de banco de horas, pontos/ocorrências,
 * checklist de hoje e uma nota rápida de eficiência (nota diária média +
 * aproveitamento de checklist no mês). Usado por /company/colaboradores/[id].
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const employee = await prisma.user.findFirst({
      where: { id, companyId, role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        consumptionDebt: true,
        employeeProfile: {
          select: {
            bankOfHoursMinutes: true,
            xpPoints: true,
            monthlySalary: true,
            workStartTime: true,
            workEndTime: true,
            weeklyDayOff: true,
            sector: { select: { id: true, name: true } },
            currentInternalLevel: { select: { id: true, name: true } },
            employmentType: true,
            contractStartDate: true,
            contractEndDate: true,
          },
        },
      },
    })
    if (!employee?.employeeProfile) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const today = startOfDay(new Date())
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const [bankAdjustments, bankOccurrences, xpEntries, occurrences, todayChecklists, monthEvaluations, monthChecklists] = await Promise.all([
      prisma.timeclockAdjustmentReview.findMany({
        where: { employeeId: id, applied: true },
        orderBy: { date: "desc" },
        take: 20,
      }),
      prisma.occurrence.findMany({
        where: { employeeId: id, type: { in: ["BANCO_HORAS", "HORA_EXTRA"] } },
        orderBy: { date: "desc" },
        take: 20,
        select: { id: true, type: true, date: true, quantity: true, description: true },
      }),
      prisma.xpEntry.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.occurrence.findMany({
        where: { employeeId: id },
        orderBy: { date: "desc" },
        take: 20,
        include: { customType: { select: { name: true } } },
      }),
      prisma.checklist.findMany({ where: { employeeId: id, forDate: today }, orderBy: { dueAt: "asc" } }),
      prisma.dailyEvaluation.findMany({ where: { employeeId: id, date: { gte: monthStart } }, select: { score: true } }),
      prisma.checklist.findMany({ where: { employeeId: id, forDate: { gte: monthStart } }, select: { status: true } }),
    ])

    const bankExtract = [
      ...bankAdjustments.map((a) => ({
        date: a.date,
        deltaMinutes: a.computedMinutes,
        label: a.kind === "LATE_CHECKIN" ? "Atraso na entrada" : a.kind === "CHECKOUT_VARIANCE" ? "Saída diferente" : "Intervalo excedido",
        source: "TIMECLOCK" as const,
      })),
      ...bankOccurrences.map((o) => ({
        date: o.date,
        // Ambos debitam o banco de horas pelo mesmo cálculo (ver app/api/company/occurrences/route.ts)
        deltaMinutes: -Math.round(Number(o.quantity) * 60),
        label: o.type === "BANCO_HORAS" ? "Folga concedida (banco de horas)" : "Hora extra paga",
        source: "OCCURRENCE" as const,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    const avgScore = monthEvaluations.length > 0 ? monthEvaluations.reduce((s, e) => s + Number(e.score), 0) / monthEvaluations.length : null
    const checklistTotal = monthChecklists.length
    const checklistApproved = monthChecklists.filter((c) => c.status === "APPROVED").length
    const checklistRate = checklistTotal > 0 ? Math.round((checklistApproved / checklistTotal) * 100) : null

    return Response.json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
      consumptionDebt: Number(employee.consumptionDebt),
      sector: employee.employeeProfile.sector,
      bankOfHoursMinutes: employee.employeeProfile.bankOfHoursMinutes,
      xpPoints: employee.employeeProfile.xpPoints,
      workStartTime: employee.employeeProfile.workStartTime,
      workEndTime: employee.employeeProfile.workEndTime,
      weeklyDayOff: employee.employeeProfile.weeklyDayOff,
      currentLevel: employee.employeeProfile.currentInternalLevel,
      employmentType: employee.employeeProfile.employmentType,
      contractStartDate: employee.employeeProfile.contractStartDate,
      contractEndDate: employee.employeeProfile.contractEndDate,
      bankExtract,
      xpEntries,
      occurrences,
      todayChecklists,
      efficiency: { avgScore, checklistTotal, checklistApproved, checklistRate },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

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
      tag,
      shiftType,
      workStartTime,
      workEndTime,
      breakStartTime,
      breakEndTime,
      dailyBreakAllowanceMinutes,
      weeklySchedule,
      weeklyDayOff,
      hasExtraMonthlyDayOff,
      isFinanceResponsible,
      isSectorCommunicationResponsible,
      employmentType,
      contractStartDate,
      contractEndDate,
      status,
    } = body

    if (sectorId) {
      const sector = await prisma.sector.findFirst({ where: { id: sectorId, companyId } })
      if (!sector) throw new ApiError(404, "Setor não encontrado nesta empresa")
    }
    if (shiftType && shiftType !== "DAY" && shiftType !== "NIGHT") throw new ApiError(400, "Turno inválido")
    if (weeklyDayOff !== undefined && weeklyDayOff !== null && (weeklyDayOff < 0 || weeklyDayOff > 6)) {
      throw new ApiError(400, "Dia de folga semanal inválido")
    }
    if (employmentType !== undefined && !["FIXO", "TEMPORARIO", "DIARISTA"].includes(employmentType)) {
      throw new ApiError(400, "Tipo de vínculo inválido")
    }
    if (status !== undefined && !["ACTIVE", "INACTIVE"].includes(status)) {
      throw new ApiError(400, "Status inválido")
    }

    const updated = await prisma.employeeProfile.update({
      where: { userId: id },
      data: {
        ...(canRegisterOccurrences !== undefined ? { canRegisterOccurrences } : {}),
        ...(monthlySalary !== undefined ? { monthlySalary: monthlySalary === null ? null : Number(monthlySalary) } : {}),
        ...(sectorId !== undefined ? { sectorId: sectorId || null } : {}),
        ...(tag !== undefined ? { tag: tag?.trim() || null } : {}),
        ...(shiftType !== undefined ? { shiftType: (shiftType as ShiftType) || null } : {}),
        ...(workStartTime !== undefined ? { workStartTime: workStartTime || null } : {}),
        ...(workEndTime !== undefined ? { workEndTime: workEndTime || null } : {}),
        ...(breakStartTime !== undefined ? { breakStartTime: breakStartTime || null } : {}),
        ...(breakEndTime !== undefined ? { breakEndTime: breakEndTime || null } : {}),
        ...(dailyBreakAllowanceMinutes !== undefined ? { dailyBreakAllowanceMinutes: Number(dailyBreakAllowanceMinutes) || 0 } : {}),
        ...(weeklySchedule !== undefined ? { weeklySchedule: weeklySchedule ?? undefined } : {}),
        ...(weeklyDayOff !== undefined ? { weeklyDayOff: weeklyDayOff === null ? null : Number(weeklyDayOff) } : {}),
        ...(hasExtraMonthlyDayOff !== undefined ? { hasExtraMonthlyDayOff: Boolean(hasExtraMonthlyDayOff) } : {}),
        ...(isFinanceResponsible !== undefined ? { isFinanceResponsible: Boolean(isFinanceResponsible) } : {}),
        ...(isSectorCommunicationResponsible !== undefined
          ? { isSectorCommunicationResponsible: Boolean(isSectorCommunicationResponsible) }
          : {}),
        ...(employmentType !== undefined ? { employmentType } : {}),
        ...(contractStartDate !== undefined ? { contractStartDate: contractStartDate ? new Date(contractStartDate) : null } : {}),
        ...(contractEndDate !== undefined ? { contractEndDate: contractEndDate ? new Date(contractEndDate) : null } : {}),
      },
    })

    // Reativação ("convocar para novo turno") — só a Gerente/Master libera o
    // acesso de um Diarista/Temporário bloqueado automaticamente (ver
    // lib/employment-access.ts). Bloqueio manual também passa por aqui.
    if (status !== undefined && status !== employee.status) {
      await prisma.user.update({ where: { id }, data: { status } })
      await notifyUser({
        userId: id,
        type: "GENERIC",
        title: status === "ACTIVE" ? "Acesso liberado" : "Acesso bloqueado",
        message: status === "ACTIVE" ? "Seu acesso à plataforma foi liberado pela Gerência." : "Seu acesso à plataforma foi bloqueado pela Gerência.",
      }).catch(() => {})
    }

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "EmployeeProfile", entityId: updated.id, details: body })

    return Response.json({ ...updated, status: status ?? employee.status })
  } catch (error) {
    return handleApiError(error)
  }
}
