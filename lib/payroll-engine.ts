import "server-only"
import { prisma } from "./prisma"
import { get5thBusinessDay, getAdvanceDate, splitFixedSalary } from "./payroll"

export const MONTH_NAMES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

/**
 * Garante que o Adiantamento (40%, dia 20) e o Saldo (60%, 5º dia útil do mês
 * seguinte) do ciclo ATUAL existam como Occurrence (type=SALARIO) para um
 * colaborador FIXO/TEMPORARIO com salário cadastrado — idempotente (a data de
 * cada lançamento É a própria data prevista de pagamento daquela fase, o que
 * serve de chave de deduplicação sem precisar de marcador textual). Chamada
 * "on read" (ver app/api/company/my-account e .../finance/receivables), mesmo
 * padrão de lib/checklist-engine.ts#ensureTodayChecklistInstances.
 */
export async function ensureCurrentPayrollEntries(companyId: string, employeeId: string, monthlySalary: number, now = new Date()) {
  if (!monthlySalary || monthlySalary <= 0) return

  const year = now.getFullYear()
  const month = now.getMonth()
  const { advance, balance } = splitFixedSalary(monthlySalary)

  const advanceDate = getAdvanceDate(year, month)
  const balanceDate = get5thBusinessDay(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)
  const label = `${MONTH_NAMES_PT[month]}/${year}`

  const [existingAdvance, existingBalance] = await Promise.all([
    prisma.occurrence.findFirst({ where: { companyId, employeeId, type: "SALARIO", date: advanceDate } }),
    prisma.occurrence.findFirst({ where: { companyId, employeeId, type: "SALARIO", date: balanceDate } }),
  ])

  const toCreate: Array<{ value: number; description: string; date: Date }> = []
  if (!existingAdvance) toCreate.push({ value: advance, description: `Adiantamento de Salário (${label})`, date: advanceDate })
  if (!existingBalance) toCreate.push({ value: balance, description: `Saldo de Salário (${label})`, date: balanceDate })
  if (toCreate.length === 0) return

  await prisma.$transaction(
    toCreate.map((entry) =>
      prisma.occurrence.create({
        data: {
          companyId,
          employeeId,
          type: "SALARIO",
          date: entry.date,
          value: entry.value,
          quantity: 1,
          total: entry.value,
          paymentStatus: "PENDING",
          expectedPaymentDate: entry.date,
          description: entry.description,
          createdById: employeeId,
        },
      }),
    ),
  )
}
