import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { ensureCurrentPayrollEntries } from "@/lib/payroll-engine"
import { getAdvanceDate, get5thBusinessDay } from "@/lib/payroll"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Folha de Pagamento (/company/folha-pagamento) — exclusivo Master/Gerente.
 * ?phase=ADVANCE (dia 20, 40% do Salário Fixo) ou BALANCE (5º dia útil,
 * Saldo 60% + Taxa de Serviço + Bônus de Metas + Domingos Trabalhados -
 * Consumo Interno - Vales). ?month=YYYY-MM escolhe o mês de referência.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const phase = searchParams.get("phase") === "BALANCE" ? "BALANCE" : "ADVANCE"
    const monthParam = searchParams.get("month")
    const now = new Date()
    const refDate = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1) : now
    const year = refDate.getFullYear()
    const month = refDate.getMonth()

    const employees = await prisma.user.findMany({
      where: { companyId, role: "EMPLOYEE", status: "ACTIVE", employeeProfile: { employmentType: { in: ["FIXO", "TEMPORARIO"] }, monthlySalary: { not: null } } },
      select: {
        id: true,
        name: true,
        employeeProfile: {
          select: { monthlySalary: true, cpf: true, bankName: true, accountType: true, agency: true, accountNumber: true, pixKey: true },
        },
      },
    })

    await Promise.all(employees.map((e) => ensureCurrentPayrollEntries(companyId, e.id, Number(e.employeeProfile!.monthlySalary), refDate)))

    const targetDate = phase === "ADVANCE" ? getAdvanceDate(year, month) : get5thBusinessDay(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 1)

    const rows = await Promise.all(
      employees.map(async (e) => {
        const salario = await prisma.occurrence.findFirst({ where: { companyId, employeeId: e.id, type: "SALARIO", date: startOfDay(targetDate) } })

        if (phase === "ADVANCE") {
          return {
            employeeId: e.id,
            name: e.name,
            bankName: e.employeeProfile!.bankName,
            accountType: e.employeeProfile!.accountType,
            agency: e.employeeProfile!.agency,
            accountNumber: e.employeeProfile!.accountNumber,
            pixKey: e.employeeProfile!.pixKey,
            document: e.employeeProfile!.cpf,
            dueDate: targetDate,
            status: salario?.paymentStatus ?? "PENDING",
            proventos: { adiantamento: Number(salario?.total ?? 0) },
            descontos: {},
            netAmount: Number(salario?.total ?? 0),
          }
        }

        const [taxaServico, metas, goalPayouts, comprasDomingo, vales, bonusEspecial, descontoEspecial] = await Promise.all([
          prisma.occurrence.aggregate({ where: { companyId, employeeId: e.id, type: "TAXA_SERVICO", date: { gte: monthStart, lt: monthEnd } }, _sum: { total: true } }),
          prisma.occurrence.aggregate({ where: { companyId, employeeId: e.id, type: "META", date: { gte: monthStart, lt: monthEnd } }, _sum: { total: true } }),
          prisma.goalPayout.aggregate({ where: { companyId, employeeId: e.id, createdAt: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
          prisma.occurrence.aggregate({ where: { companyId, employeeId: e.id, type: "COMPRA_DOMINGO", date: { gte: monthStart, lt: monthEnd } }, _sum: { total: true } }),
          prisma.occurrence.aggregate({ where: { companyId, employeeId: e.id, type: "VALE", date: { gte: monthStart, lt: monthEnd } }, _sum: { total: true } }),
          prisma.occurrence.aggregate({ where: { companyId, employeeId: e.id, type: "BONUS_ESPECIAL", date: { gte: monthStart, lt: monthEnd } }, _sum: { total: true } }),
          prisma.occurrence.aggregate({ where: { companyId, employeeId: e.id, type: "DESCONTO_ESPECIAL", date: { gte: monthStart, lt: monthEnd } }, _sum: { total: true } }),
        ])

        const userRow = await prisma.user.findUniqueOrThrow({ where: { id: e.id }, select: { consumptionDebt: true } })

        const proventos = {
          saldoSalario: Number(salario?.total ?? 0),
          taxaServico: Math.abs(Number(taxaServico._sum.total ?? 0)),
          metas: Math.abs(Number(metas._sum.total ?? 0)) + Number(goalPayouts._sum.amount ?? 0),
          comprasDomingo: Math.abs(Number(comprasDomingo._sum.total ?? 0)),
          bonusEspecial: Math.abs(Number(bonusEspecial._sum.total ?? 0)),
        }
        const descontos = {
          consumoInterno: Number(userRow.consumptionDebt),
          vales: Math.abs(Number(vales._sum.total ?? 0)),
          descontoEspecial: Math.abs(Number(descontoEspecial._sum.total ?? 0)),
        }
        const totalProventos = Object.values(proventos).reduce((s, v) => s + v, 0)
        const totalDescontos = Object.values(descontos).reduce((s, v) => s + v, 0)

        return {
          employeeId: e.id,
          name: e.name,
          bankName: e.employeeProfile!.bankName,
          accountType: e.employeeProfile!.accountType,
          agency: e.employeeProfile!.agency,
          accountNumber: e.employeeProfile!.accountNumber,
          pixKey: e.employeeProfile!.pixKey,
          document: e.employeeProfile!.cpf,
          dueDate: targetDate,
          status: salario?.paymentStatus ?? "PENDING",
          proventos,
          descontos,
          netAmount: Math.round((totalProventos - totalDescontos) * 100) / 100,
        }
      }),
    )

    return Response.json({ phase, month: `${year}-${String(month + 1).padStart(2, "0")}`, dueDate: targetDate, rows })
  } catch (error) {
    return handleApiError(error)
  }
}
