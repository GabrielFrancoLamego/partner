import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

/** Status da "1 Folga Adicional por Mês" (ver EmployeeProfile.hasExtraMonthlyDayOff) no mês corrente ou informado. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const employeeProfile = await prisma.employeeProfile.findFirst({ where: { userId: id, user: { companyId } } })
    if (!employeeProfile) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") ?? currentMonth()

    const record = await prisma.monthlyDayOffRecord.findUnique({
      where: { employeeProfileId_month: { employeeProfileId: employeeProfile.id, month } },
    })

    return Response.json(record ?? { employeeProfileId: employeeProfile.id, month, used: false, paidOut: false, paidAmount: null })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Registra o uso da folga adicional do mês, ou — se ela não foi gozada —
 * gera o pagamento equivalente a 1 diária (monthlySalary/30) junto à folha,
 * lançando uma Occurrence PENDING no mesmo ledger usado pelo Financeiro
 * (ver /api/company/finance/receivables).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const employeeProfile = await prisma.employeeProfile.findFirst({ where: { userId: id, user: { companyId } } })
    if (!employeeProfile) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
    if (!employeeProfile.hasExtraMonthlyDayOff) throw new ApiError(400, "Este colaborador não tem direito a folga adicional mensal")

    const body = await request.json()
    const { month, action } = body as { month?: string; action: "mark_used" | "mark_paid" }
    const targetMonth = month ?? currentMonth()

    if (action === "mark_used") {
      const record = await prisma.monthlyDayOffRecord.upsert({
        where: { employeeProfileId_month: { employeeProfileId: employeeProfile.id, month: targetMonth } },
        update: { used: true, usedDate: new Date() },
        create: { employeeProfileId: employeeProfile.id, companyId, month: targetMonth, used: true, usedDate: new Date() },
      })
      await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "MonthlyDayOffRecord", entityId: record.id, details: { action } })
      return Response.json(record)
    }

    if (action === "mark_paid") {
      const existing = await prisma.monthlyDayOffRecord.findUnique({
        where: { employeeProfileId_month: { employeeProfileId: employeeProfile.id, month: targetMonth } },
      })
      if (existing?.used) throw new ApiError(400, "A folga já foi gozada neste mês — não há pagamento a gerar")
      if (existing?.paidOut) throw new ApiError(400, "O pagamento desta folga já foi gerado")
      if (!employeeProfile.monthlySalary) throw new ApiError(400, "Cadastre o salário-base do colaborador antes de gerar o pagamento")

      const perDiem = Number(employeeProfile.monthlySalary) / 30

      const [record] = await prisma.$transaction([
        prisma.monthlyDayOffRecord.upsert({
          where: { employeeProfileId_month: { employeeProfileId: employeeProfile.id, month: targetMonth } },
          update: { paidOut: true, paidAmount: perDiem },
          create: { employeeProfileId: employeeProfile.id, companyId, month: targetMonth, paidOut: true, paidAmount: perDiem },
        }),
        prisma.occurrence.create({
          data: {
            companyId,
            employeeId: id,
            type: "FOLGA_FERIADO",
            value: perDiem,
            quantity: 1,
            total: perDiem,
            paymentStatus: "PENDING",
            description: `Folga adicional de ${targetMonth} não gozada — pagamento equivalente a 1 diária`,
            createdById: user.id,
          },
        }),
      ])

      await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "MonthlyDayOffRecord", entityId: record.id, details: { action, perDiem } })
      return Response.json(record)
    }

    throw new ApiError(400, "Ação inválida")
  } catch (error) {
    return handleApiError(error)
  }
}
