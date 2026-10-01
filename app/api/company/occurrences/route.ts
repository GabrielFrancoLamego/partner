import type { OccurrenceType, OccurrencePaymentMethod, OccurrencePaymentStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { awardXp, getInternalProgramRules } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

const OCCURRENCE_TYPES: OccurrenceType[] = [
  "FOLGA_FERIADO",
  "VALE",
  "CONSUMO",
  "QUEBRA_CAIXA",
  "PAGAMENTO_CONSUMO",
  "META",
  "FALTA",
  "ATESTADO",
  "ADVERTENCIA",
  "SUSPENSAO",
  "DIARIA",
  "HORA_EXTRA",
  "BANCO_HORAS",
  "DISPENSADO",
  "FIXADO",
  "CUSTOM",
]
// CONSUMO/QUEBRA_CAIXA exigem a foto da comanda/registro assinado como comprovante.
const REQUIRES_ATTACHMENT: OccurrenceType[] = ["ADVERTENCIA", "ATESTADO", "DISPENSADO", "CONSUMO", "QUEBRA_CAIXA"]
const PAYMENT_METHODS: OccurrencePaymentMethod[] = ["DINHEIRO", "PIX", "TRABALHO", "FOLGA_ADICIONAL", "CONSUMO"]
const PAYMENT_STATUSES: OccurrencePaymentStatus[] = ["PENDING", "PAID"]

// Rótulos em português — mesmo texto usado em app/company/ocorrencias/page.tsx,
// reaproveitado aqui para a notificação de clareza enviada ao colaborador.
const TYPE_LABELS: Record<OccurrenceType, string> = {
  FOLGA_FERIADO: "Folga/Feriado",
  VALE: "Vale/Adiantamento",
  CONSUMO: "Consumo (Conta/Comanda)",
  QUEBRA_CAIXA: "Quebra de Caixa",
  PAGAMENTO_CONSUMO: "Pagamento de Consumo",
  META: "Bonificação de meta",
  FALTA: "Falta",
  ATESTADO: "Atestado",
  ADVERTENCIA: "Advertência",
  SUSPENSAO: "Suspensão",
  DIARIA: "Diária (temporário)",
  HORA_EXTRA: "Hora extra",
  BANCO_HORAS: "Banco de horas",
  DISPENSADO: "Desligamento",
  FIXADO: "Efetivação",
  CUSTOM: "Personalizado",
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Painel completo — exclusivo de Gerente/Master/Admin (canManageDailyOperations).
 * Colaboradores em modo CREATE_ONLY (EmployeeProfile.canRegisterOccurrences)
 * não têm acesso de leitura ao histórico, só ao POST abaixo.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    if (!canManageDailyOperations(user.role)) throw new ApiError(403, "Sem permissão para esta ação")
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") // "2026-09"
    const employeeId = searchParams.get("employeeId")
    const type = searchParams.get("type") // OccurrenceType, ou "CUSTOM:<id>" para um tipo configurável específico
    const from = searchParams.get("from") // YYYY-MM-DD — sobrepõe `month` quando presente
    const to = searchParams.get("to")

    let dateWhere: { gte: Date; lt: Date } | undefined
    if (from && to) {
      dateWhere = { gte: startOfDay(new Date(from)), lt: new Date(startOfDay(new Date(to)).getTime() + 24 * 60 * 60 * 1000) }
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number)
      dateWhere = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
    }

    let typeWhere: Prisma.OccurrenceWhereInput = {}
    if (type?.startsWith("CUSTOM:")) {
      typeWhere = { type: "CUSTOM", customTypeId: type.slice("CUSTOM:".length) }
    } else if (type && OCCURRENCE_TYPES.includes(type as OccurrenceType)) {
      typeWhere = { type: type as OccurrenceType }
    }

    const occurrences = await prisma.occurrence.findMany({
      where: {
        companyId,
        ...(dateWhere ? { date: dateWhere } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...typeWhere,
      },
      include: {
        employee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        customType: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    })

    return Response.json(occurrences)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const isManager = canManageDailyOperations(user.role)

    if (!isManager) {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { canRegisterOccurrences: true },
      })
      if (!profile?.canRegisterOccurrences) throw new ApiError(403, "Sem permissão para registrar ocorrências")
    }

    const formData = await request.formData()
    const employeeId = formData.get("employeeId")
    const employeeNameFreeText = formData.get("employeeNameFreeText")
    const type = formData.get("type")
    const customTypeIdRaw = formData.get("customTypeId")
    const dateRaw = formData.get("date")
    const value = formData.get("value")
    const quantityRaw = formData.get("quantity")
    const paymentMethod = formData.get("paymentMethod")
    const paymentStatus = formData.get("paymentStatus")
    const description = formData.get("description")
    const file = formData.get("file")

    if (typeof type !== "string" || !OCCURRENCE_TYPES.includes(type as OccurrenceType)) {
      throw new ApiError(400, "Tipo de ocorrência inválido")
    }

    let customType: { id: string; kind: string; pointsImpact: number | null; salaryImpactType: string | null; salaryImpactValue: Prisma.Decimal | null; hoursBankImpactMinutes: number | null } | null = null
    if (type === "CUSTOM") {
      if (typeof customTypeIdRaw !== "string" || !customTypeIdRaw) throw new ApiError(400, "Selecione o tipo de ocorrência configurado")
      customType = await prisma.occurrenceTypeConfig.findFirst({ where: { id: customTypeIdRaw, companyId, active: true } })
      if (!customType) throw new ApiError(404, "Tipo de ocorrência configurado não encontrado")
    }

    const hasEmployeeId = typeof employeeId === "string" && employeeId.length > 0
    const hasFreeText = typeof employeeNameFreeText === "string" && employeeNameFreeText.trim().length > 0
    if (!hasEmployeeId && !hasFreeText) {
      throw new ApiError(400, "Informe o colaborador cadastrado ou o nome do temporário/diarista")
    }

    let employee: { id: string; monthlySalary: Prisma.Decimal | null } | null = null
    if (hasEmployeeId) {
      const found = await prisma.user.findFirst({
        where: { id: employeeId as string, companyId },
        select: { id: true, employeeProfile: { select: { monthlySalary: true } } },
      })
      if (!found) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
      employee = { id: found.id, monthlySalary: found.employeeProfile?.monthlySalary ?? null }
    }

    if (typeof paymentMethod === "string" && paymentMethod && !PAYMENT_METHODS.includes(paymentMethod as OccurrencePaymentMethod)) {
      throw new ApiError(400, "Forma de pagamento inválida")
    }
    if (typeof paymentStatus === "string" && paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus as OccurrencePaymentStatus)) {
      throw new ApiError(400, "Status de pagamento inválido")
    }

    if (REQUIRES_ATTACHMENT.includes(type as OccurrenceType) && !(file instanceof File && file.size > 0)) {
      throw new ApiError(400, "Anexo é obrigatório para este tipo de ocorrência (foto/documento)")
    }

    const attachmentUrl = file instanceof File && file.size > 0 ? await uploadImage("occurrences", file) : null
    const date = typeof dateRaw === "string" && dateRaw ? new Date(dateRaw) : new Date()
    const quantity = quantityRaw && typeof quantityRaw === "string" ? Number(quantityRaw) : 1

    // FALTA sem valor informado: abate automático de 1 dia com base no salário
    // mensal cadastrado (quando houver). Gerente ainda pode sobrescrever `value`.
    let resolvedValue = value && typeof value === "string" && value !== "" ? Number(value) : null
    if (type === "FALTA" && resolvedValue === null && employee?.monthlySalary) {
      resolvedValue = -(Number(employee.monthlySalary) / 30)
    }
    if (type === "CUSTOM" && customType?.kind === "SALARY" && resolvedValue === null && customType.salaryImpactValue) {
      const magnitude = Number(customType.salaryImpactValue)
      resolvedValue = customType.salaryImpactType === "DISCOUNT" ? -Math.abs(magnitude) : Math.abs(magnitude)
    }
    if (type === "PAGAMENTO_CONSUMO" && resolvedValue === null) {
      throw new ApiError(400, "Informe o valor pago pelo colaborador")
    }
    const total = resolvedValue !== null ? Math.round(resolvedValue * quantity * 100) / 100 : null

    const occurrence = await prisma.$transaction(async (tx) => {
      const created = await tx.occurrence.create({
        data: {
          companyId,
          employeeId: employee?.id ?? null,
          employeeNameFreeText: employee ? null : (employeeNameFreeText as string).trim(),
          type: type as OccurrenceType,
          customTypeId: customType?.id ?? null,
          date,
          value: resolvedValue,
          quantity,
          total,
          paymentMethod: (paymentMethod as OccurrencePaymentMethod) || null,
          paymentStatus: (paymentStatus as OccurrencePaymentStatus) || "PENDING",
          description: typeof description === "string" && description ? description.trim() : null,
          attachmentUrl,
          createdById: user.id,
        },
        include: {
          employee: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          customType: { select: { id: true, name: true, kind: true } },
        },
      })

      // Tipo configurável com impacto em Banco de Horas — credita (positivo) ou
      // debita (negativo) diretamente, ex: "Folga Extra Concedida" abate horas extras.
      if (customType?.kind === "HOURS_BANK" && customType.hoursBankImpactMinutes && employee) {
        await tx.employeeProfile.update({
          where: { userId: employee.id },
          data: { bankOfHoursMinutes: { increment: Math.round(customType.hoursBankImpactMinutes * quantity) } },
        })
      }

      // Uso de Banco de Horas — Gerente concede folga/saída antecipada usando o
      // saldo do colaborador: `quantity` = horas concedidas, sempre debitadas
      // (pode ficar negativo = o colaborador "deve" horas à empresa).
      if (type === "BANCO_HORAS" && employee) {
        await tx.employeeProfile.update({
          where: { userId: employee.id },
          data: { bankOfHoursMinutes: { decrement: Math.round(quantity * 60) } },
        })
      }

      // Pagamento de Horas Extras — pagar a hora extra "gasta" o banco de horas
      // correspondente (mesmo se isso deixar o saldo negativo — vira dívida de
      // horas do colaborador, a Gerente decide se paga mesmo assim).
      if (type === "HORA_EXTRA" && employee) {
        await tx.employeeProfile.update({
          where: { userId: employee.id },
          data: { bankOfHoursMinutes: { decrement: Math.round(quantity * 60) } },
        })
      }

      // Conta de Consumo — a comanda assinada vira dívida do colaborador (ou
      // Gerente) com a empresa, descontada do salário; pagar QUALQUER outra
      // ocorrência de valor positivo com a forma "Consumo" abate essa dívida
      // em vez de sair dinheiro novo (ver User.consumptionDebt).
      if (type === "CONSUMO" && employee && total !== null) {
        await tx.user.update({ where: { id: employee.id }, data: { consumptionDebt: { increment: Math.abs(total) } } })
      } else if (paymentMethod === "CONSUMO" && employee && total !== null && total > 0) {
        await tx.user.update({ where: { id: employee.id }, data: { consumptionDebt: { decrement: total } } })
      }

      // Pagamento de Consumo — dinheiro/PIX recebido do colaborador abatendo
      // a Conta de Consumo diretamente (sentido inverso de CONSUMO acima;
      // independente da escolha de `paymentMethod`, que aqui descreve só como
      // o colaborador pagou, não um abatimento via outra ocorrência).
      if (type === "PAGAMENTO_CONSUMO" && employee && total !== null) {
        await tx.user.update({ where: { id: employee.id }, data: { consumptionDebt: { decrement: Math.abs(total) } } })
      }

      // Abono automático: ATESTADO registrado em até 24h de uma FALTA do
      // mesmo colaborador no mesmo dia perdoa o abate daquela falta — e
      // reverte a penalidade de XP de falta sem atestado já creditada (ver
      // bloco de XP abaixo), já que a ausência passa a ser justificada.
      let waivedFaltaId: string | null = null
      if (type === "ATESTADO" && employee) {
        const matchingFalta = await tx.occurrence.findFirst({
          where: {
            companyId,
            employeeId: employee.id,
            type: "FALTA",
            discountWaived: false,
            date: { gte: startOfDay(date), lt: new Date(startOfDay(date).getTime() + 24 * 60 * 60 * 1000) },
            createdAt: { gte: new Date(Date.now() - TWENTY_FOUR_HOURS_MS) },
          },
          orderBy: { createdAt: "desc" },
        })
        if (matchingFalta) {
          await tx.occurrence.update({ where: { id: matchingFalta.id }, data: { discountWaived: true } })
          waivedFaltaId = matchingFalta.id
        }
      }

      return { created, waivedFaltaId }
    })

    const rules = await getInternalProgramRules(companyId)
    let appliedPoints = 0

    if (employee) {
      // ADVERTENCIA e SUSPENSAO são as duas ocorrências disciplinares fixas —
      // InternalProgram.pointsOccurrence já é documentado no schema como
      // "ADVERTENCIA/demais ocorrências", então a Suspensão deve aplicar a
      // mesma penalidade (antes só Advertência aplicava, na prática).
      if (type === "ADVERTENCIA" || type === "SUSPENSAO") {
        appliedPoints = rules.pointsOccurrence
        await awardXp({
          companyId,
          employeeId: employee.id,
          reason: "OCCURRENCE_PENALTY",
          points: rules.pointsOccurrence,
          sourceId: occurrence.created.id,
          note: type === "ADVERTENCIA" ? "Advertência registrada" : "Suspensão registrada",
        })
      } else if (type === "FALTA") {
        appliedPoints = rules.pointsAbsenceUnjustified
        await awardXp({
          companyId,
          employeeId: employee.id,
          reason: "OCCURRENCE_PENALTY",
          points: rules.pointsAbsenceUnjustified,
          sourceId: occurrence.created.id,
          note: "Falta sem atestado",
        })
      } else if (type === "ATESTADO") {
        appliedPoints = rules.pointsAbsenceJustified
        await awardXp({
          companyId,
          employeeId: employee.id,
          reason: "OCCURRENCE_PENALTY",
          points: rules.pointsAbsenceJustified,
          sourceId: occurrence.created.id,
          note: "Falta com atestado",
        })
        // Reverte o XP da FALTA que este ATESTADO acabou de abonar (mesmo
        // padrão de reaplicação usado em app/api/company/evaluations).
        if (occurrence.waivedFaltaId) {
          const previousEntry = await prisma.xpEntry.findFirst({
            where: { sourceId: occurrence.waivedFaltaId, reason: "OCCURRENCE_PENALTY" },
          })
          if (previousEntry) {
            await prisma.xpEntry.delete({ where: { id: previousEntry.id } })
            await prisma.employeeProfile.update({
              where: { userId: employee.id },
              data: { xpPoints: { decrement: previousEntry.points } },
            })
          }
        }
      } else if (type === "CUSTOM" && customType?.kind === "POINTS" && customType.pointsImpact) {
        appliedPoints = Math.round(customType.pointsImpact * quantity)
        await awardXp({
          companyId,
          employeeId: employee.id,
          reason: "MANUAL_ADJUSTMENT",
          points: appliedPoints,
          sourceId: occurrence.created.id,
          note: occurrence.created.customType?.name ?? "Ocorrência configurável",
        })
      }

      // Clareza para o colaborador: dados e motivo de toda ocorrência lançada
      // contra ele — pontos, valor financeiro (crédito ou desconto) e/ou banco
      // de horas (quando um tipo configurável tiver esse impacto), tudo num só
      // lugar, sem ele precisar ir caçar no extrato.
      const typeLabel = type === "CUSTOM" ? occurrence.created.customType?.name ?? "Ocorrência" : TYPE_LABELS[type as OccurrenceType]
      const parts: string[] = []
      if (total !== null) {
        const formatted = Math.abs(total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        parts.push(total < 0 ? `desconto de ${formatted}` : `crédito de ${formatted}`)
      }
      if (appliedPoints !== 0) parts.push(`${appliedPoints > 0 ? "+" : ""}${appliedPoints} pontos`)
      if (customType?.kind === "HOURS_BANK" && customType.hoursBankImpactMinutes) {
        const mins = Math.round(customType.hoursBankImpactMinutes * quantity)
        parts.push(`${mins > 0 ? "+" : ""}${mins}min no banco de horas`)
      }
      if (type === "BANCO_HORAS") parts.push(`-${Math.round(quantity * 60)}min no banco de horas (folga concedida)`)
      if (type === "HORA_EXTRA") parts.push(`-${Math.round(quantity * 60)}min no banco de horas (hora extra paga)`)
      if (type === "CONSUMO" && total !== null) {
        parts.push(`+${Math.abs(total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} na Conta de Consumo`)
      } else if (type === "PAGAMENTO_CONSUMO" && total !== null) {
        parts.push(`-${Math.abs(total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} abatidos da Conta de Consumo (pagamento recebido)`)
      } else if (paymentMethod === "CONSUMO" && total !== null && total > 0) {
        parts.push(`-${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} abatidos da Conta de Consumo`)
      }
      await notifyUser({
        userId: employee.id,
        type: "GENERIC",
        title: `Ocorrência registrada: ${typeLabel}`,
        message:
          (parts.length > 0 ? `${parts.join(" · ")}. ` : "") +
          (typeof description === "string" && description.trim() ? `Motivo: ${description.trim()}` : "Sem motivo detalhado informado."),
        linkUrl: "/company/crescimento",
      }).catch(() => {})
    }

    await logAudit({
      userId: user.id,
      companyId,
      action: "CREATE",
      entity: "Occurrence",
      entityId: occurrence.created.id,
      details: { employeeId: employee?.id ?? null, employeeNameFreeText, type },
    })

    return Response.json(occurrence.created, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
