import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { periodStart } from "@/lib/period-range"
import { ensureCurrentPayrollEntries } from "@/lib/payroll-engine"

type Bucket = { paid: number; pending: number; nextDate: string | null }

function emptyBucket(): Bucket {
  return { paid: 0, pending: 0, nextDate: null }
}

function accumulate(bucket: Bucket, total: number, status: "PAID" | "PENDING", expectedDate: Date | null) {
  if (status === "PAID") bucket.paid += total
  else {
    bucket.pending += total
    if (expectedDate && (!bucket.nextDate || expectedDate < new Date(bucket.nextDate))) bucket.nextDate = expectedDate.toISOString()
  }
}

/**
 * Widget "Sua Conta" — extrato financeiro detalhado do próprio colaborador
 * (Ganhos: Salário Fixo/Taxa de Serviço/Metas/Diárias/Compra de Domingo/
 * Outros Adicionais; Descontos: Consumo Interno/Vales/Descontos Diversos/
 * Impostos), com o resumo Já Recebido vs A Receber + próxima data prevista.
 * Reaproveita Occurrence.total+paymentStatus (ver app/api/company/occurrences)
 * como ledger único — a única exceção é Metas, cuja fonte de verdade é
 * GoalPayout (a Occurrence type=META irmã é só um espelho, ver schema).
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    if (user.role !== "EMPLOYEE") throw new ApiError(403, "Sem permissão para esta ação")
    const companyId = user.companyId
    const employeeId = user.id

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") ?? "month"
    const start = periodStart(period)
    const dateWhere = start ? { gte: start } : undefined

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: employeeId },
      select: { employmentType: true, monthlySalary: true },
    })

    if (profile?.employmentType !== "DIARISTA" && profile?.monthlySalary) {
      await ensureCurrentPayrollEntries(companyId, employeeId, Number(profile.monthlySalary)).catch(() => {})
    }

    const [occurrences, goalPayouts, targetUser] = await Promise.all([
      prisma.occurrence.findMany({
        where: { companyId, employeeId, total: { not: null }, ...(dateWhere ? { date: dateWhere } : {}) },
        select: {
          id: true,
          type: true,
          total: true,
          paymentStatus: true,
          expectedPaymentDate: true,
          date: true,
          description: true,
          paymentMethod: true,
          discountWaived: true,
          goalPayout: { select: { id: true } },
          customType: { select: { name: true, salaryImpactType: true, isTax: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.goalPayout.findMany({
        where: { companyId, employeeId, ...(dateWhere ? { paidAt: dateWhere } : {}) },
        select: { amount: true, status: true, expectedPaymentDate: true, paidAt: true, goal: { select: { name: true } } },
        orderBy: { paidAt: "desc" },
      }),
      prisma.user.findUniqueOrThrow({ where: { id: employeeId }, select: { consumptionDebt: true } }),
    ])

    const salarioFixo = emptyBucket()
    const taxaServico = emptyBucket()
    const diarias = emptyBucket()
    const comprasDomingo = emptyBucket()
    const outrosAdicionais = emptyBucket()
    const metas = emptyBucket()

    let vales = 0
    let descontosDiversos = 0
    let impostos = 0

    for (const o of occurrences) {
      const total = Number(o.total ?? 0)
      const status = o.paymentStatus
      const expected = o.expectedPaymentDate

      if (o.type === "SALARIO") accumulate(salarioFixo, Math.abs(total), status, expected)
      else if (o.type === "TAXA_SERVICO") accumulate(taxaServico, Math.abs(total), status, expected)
      else if (o.type === "DIARIA") accumulate(diarias, Math.abs(total), status, expected)
      else if (o.type === "COMPRA_DOMINGO") accumulate(comprasDomingo, Math.abs(total), status, expected)
      else if (o.type === "META" && !o.goalPayout) accumulate(metas, Math.abs(total), status, expected)
      else if (o.type === "VALE") vales += Math.abs(total)
      // Bônus Especial (Master) e Hora Extra somam aos ganhos; Desconto Especial, Quebra de Caixa e
      // Falta (não abonada) entram em Descontos Diversos — o extrato recalcula a cada lançamento.
      else if (o.type === "BONUS_ESPECIAL" || o.type === "HORA_EXTRA") accumulate(outrosAdicionais, Math.abs(total), status, expected)
      else if (o.type === "DESCONTO_ESPECIAL" || o.type === "QUEBRA_CAIXA" || (o.type === "FALTA" && !o.discountWaived)) descontosDiversos += Math.abs(total)
      else if (o.type === "CUSTOM" && o.customType?.salaryImpactType === "BONUS") accumulate(outrosAdicionais, Math.abs(total), status, expected)
      else if (o.type === "CUSTOM" && o.customType?.salaryImpactType === "DISCOUNT") {
        if (o.customType.isTax) impostos += Math.abs(total)
        else descontosDiversos += Math.abs(total)
      }
    }

    for (const p of goalPayouts) {
      accumulate(metas, Number(p.amount), p.status, p.expectedPaymentDate)
    }

    const totalRecebidoPeriodo = salarioFixo.paid + taxaServico.paid + diarias.paid + comprasDomingo.paid + outrosAdicionais.paid + metas.paid
    const totalAReceber = salarioFixo.pending + taxaServico.pending + diarias.pending + comprasDomingo.pending + outrosAdicionais.pending + metas.pending

    const nextDates = [salarioFixo.nextDate, taxaServico.nextDate, diarias.nextDate, comprasDomingo.nextDate, outrosAdicionais.nextDate, metas.nextDate].filter(
      (d): d is string => Boolean(d),
    )
    const proximaDataPrevista = nextDates.length > 0 ? nextDates.sort()[0] : null

    return Response.json({
      period,
      earnings: { salarioFixo, taxaServico, metas, diarias, comprasDomingo, outrosAdicionais },
      discounts: {
        consumoInterno: Number(targetUser.consumptionDebt),
        vales,
        descontosDiversos,
        impostos,
      },
      totals: { totalRecebidoPeriodo, totalAReceber, proximaDataPrevista },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
