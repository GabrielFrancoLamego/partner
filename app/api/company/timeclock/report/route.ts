import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Dados consolidados para o Relatório de Ponto em PDF (impresso pelo navegador) — ver /company/ponto/relatorio. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId") || user.id
    const fromRaw = searchParams.get("from")
    const toRaw = searchParams.get("to")

    if (employeeId !== user.id) requireCapability(user, canManageDailyOperations)

    const from = startOfDay(fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const to = new Date(startOfDay(toRaw ? new Date(toRaw) : new Date()).getTime() + 24 * 60 * 60 * 1000)

    const [employee, entries, occurrences] = await Promise.all([
      prisma.user.findFirst({
        where: { id: employeeId, companyId },
        select: { name: true, employeeProfile: { select: { bankOfHoursMinutes: true, workStartTime: true, workEndTime: true } } },
      }),
      prisma.timeEntry.findMany({
        where: { companyId, userId: employeeId, createdAt: { gte: from, lt: to } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.occurrence.findMany({
        where: { companyId, employeeId, date: { gte: from, lt: to }, type: { in: ["FALTA", "HORA_EXTRA", "ATESTADO"] } },
        select: { type: true, date: true, quantity: true, discountWaived: true },
      }),
    ])
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const faltas = occurrences.filter((o) => o.type === "FALTA" && !o.discountWaived).length
    const atestados = occurrences.filter((o) => o.type === "ATESTADO").length
    const horasExtrasOcorrencias = occurrences.filter((o) => o.type === "HORA_EXTRA").reduce((s, o) => s + Number(o.quantity), 0)

    return Response.json({
      employeeName: employee.name,
      period: { from, to },
      entries,
      faltas,
      atestados,
      horasExtrasOcorrencias,
      bankOfHoursMinutes: employee.employeeProfile?.bankOfHoursMinutes ?? 0,
      workStartTime: employee.employeeProfile?.workStartTime ?? null,
      workEndTime: employee.employeeProfile?.workEndTime ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
