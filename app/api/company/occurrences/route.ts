import type { OccurrenceType, OccurrencePaymentMethod, OccurrencePaymentStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { awardXp } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

const WARNING_XP_PENALTY = -10
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

const OCCURRENCE_TYPES: OccurrenceType[] = [
  "FOLGA_FERIADO",
  "VALE",
  "CONSUMO",
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
]
const REQUIRES_ATTACHMENT: OccurrenceType[] = ["ADVERTENCIA", "ATESTADO", "DISPENSADO"]
const PAYMENT_METHODS: OccurrencePaymentMethod[] = ["DINHEIRO", "PIX", "TRABALHO", "FOLGA_ADICIONAL"]
const PAYMENT_STATUSES: OccurrencePaymentStatus[] = ["PENDING", "PAID"]

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

    let dateWhere: { gte: Date; lt: Date } | undefined
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number)
      dateWhere = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
    }

    const occurrences = await prisma.occurrence.findMany({
      where: {
        companyId,
        ...(dateWhere ? { date: dateWhere } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
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
    const total = resolvedValue !== null ? Math.round(resolvedValue * quantity * 100) / 100 : null

    const occurrence = await prisma.$transaction(async (tx) => {
      const created = await tx.occurrence.create({
        data: {
          companyId,
          employeeId: employee?.id ?? null,
          employeeNameFreeText: employee ? null : (employeeNameFreeText as string).trim(),
          type: type as OccurrenceType,
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
        include: { employee: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
      })

      // Abono automático: ATESTADO registrado em até 24h de uma FALTA do
      // mesmo colaborador no mesmo dia perdoa o abate daquela falta.
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
        }
      }

      return created
    })

    if (type === "ADVERTENCIA" && employee) {
      await awardXp({
        companyId,
        employeeId: employee.id,
        reason: "OCCURRENCE_PENALTY",
        points: WARNING_XP_PENALTY,
        sourceId: occurrence.id,
        note: "Advertência registrada",
      })
    }

    await logAudit({
      userId: user.id,
      companyId,
      action: "CREATE",
      entity: "Occurrence",
      entityId: occurrence.id,
      details: { employeeId: employee?.id ?? null, employeeNameFreeText, type },
    })

    return Response.json(occurrence, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
