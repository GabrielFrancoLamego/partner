import type { CompanyCalendarEventKind } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const KINDS: CompanyCalendarEventKind[] = ["HOLIDAY", "CLOSED"]

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Calendário Operacional — Feriados e Dias Fechados do estabelecimento (ver /company/configuracoes). Leitura liberada a todo staff (checklist/dashboard precisam saber se o dia está fechado). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const events = await prisma.companyCalendarEvent.findMany({
      where: { companyId: user.companyId },
      orderBy: { date: "asc" },
    })
    return Response.json(events)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const companyId = user.companyId

    const body = await request.json()
    const { date, kind, isPaidHoliday, label } = body as { date?: string; kind?: CompanyCalendarEventKind; isPaidHoliday?: boolean; label?: string }

    if (!date) throw new ApiError(400, "Informe a data")
    if (!kind || !KINDS.includes(kind)) throw new ApiError(400, "Tipo inválido — use Feriado ou Dia Fechado")

    const event = await prisma.companyCalendarEvent.upsert({
      where: { companyId_date: { companyId, date: startOfDay(new Date(date)) } },
      update: { kind, isPaidHoliday: kind === "HOLIDAY" ? Boolean(isPaidHoliday) : false, label: label?.trim() || null },
      create: {
        companyId,
        date: startOfDay(new Date(date)),
        kind,
        isPaidHoliday: kind === "HOLIDAY" ? Boolean(isPaidHoliday) : false,
        label: label?.trim() || null,
        createdById: user.id,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "CompanyCalendarEvent", entityId: event.id, details: body })

    return Response.json(event, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
