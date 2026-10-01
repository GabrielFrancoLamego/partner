import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function validateTime(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || !TIME_RE.test(value)) throw new ApiError(400, `${label} inválido — use o formato HH:mm`)
  return value
}

/**
 * Configurações operacionais da própria empresa — horário-limite do
 * fechamento diário da Gerente e os turnos de funcionamento (até 2 por dia).
 * Antes só o Admin da plataforma editava isso (ver /admin/empresas); o Master
 * da empresa também precisa poder ajustar sem depender do Admin.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: {
        shiftClosingDeadline: true,
        operatingShift1Start: true,
        operatingShift1End: true,
        operatingShift2Start: true,
        operatingShift2End: true,
      },
    })

    return Response.json(company)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)

    const body = await request.json()
    const shiftClosingDeadline = validateTime(body.shiftClosingDeadline, "Horário-limite do fechamento")
    const operatingShift1Start = validateTime(body.operatingShift1Start, "Início do 1º turno")
    const operatingShift1End = validateTime(body.operatingShift1End, "Fim do 1º turno")
    const operatingShift2Start = validateTime(body.operatingShift2Start, "Início do 2º turno")
    const operatingShift2End = validateTime(body.operatingShift2End, "Fim do 2º turno")

    if (!shiftClosingDeadline) throw new ApiError(400, "Horário-limite do fechamento é obrigatório")

    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        shiftClosingDeadline,
        operatingShift1Start,
        operatingShift1End,
        operatingShift2Start,
        operatingShift2End,
      },
      select: {
        shiftClosingDeadline: true,
        operatingShift1Start: true,
        operatingShift1End: true,
        operatingShift2Start: true,
        operatingShift2End: true,
      },
    })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "UPDATE",
      entity: "Company",
      entityId: user.companyId,
      details: { settings: company },
    })

    return Response.json(company)
  } catch (error) {
    return handleApiError(error)
  }
}
