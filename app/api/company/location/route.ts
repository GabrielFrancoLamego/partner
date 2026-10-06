import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const SELECT = { address: true, neighborhood: true, city: true, state: true, zipCode: true, phone: true, latitude: true, longitude: true, name: true } as const

function optionalText(value: unknown, max = 200): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") throw new ApiError(400, "Dado de endereço inválido")
  const trimmed = value.trim()
  if (trimmed.length > max) throw new ApiError(400, "Texto muito longo")
  return trimmed || null
}

function coordinate(value: unknown, label: string, limit: number): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  if (Number.isNaN(n) || Math.abs(n) > limit) throw new ApiError(400, `${label} inválida`)
  return Math.round(n * 1e6) / 1e6
}

/**
 * Localização e contato do estabelecimento — endereço, telefone/WhatsApp oficial
 * e coordenadas exatas (latitude/longitude) definidas arrastando o pin no mapa
 * (/company/configuracoes). Alimenta o centro do geofence do ponto digital, o
 * mapa dos parceiros e a página do voucher do cliente (botões "Traçar rota" e
 * "Ligar/Reservar"). Exclusivo do Master.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const company = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId }, select: SELECT })
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
    const latitude = coordinate(body.latitude, "Latitude", 90)
    const longitude = coordinate(body.longitude, "Longitude", 180)
    if ((latitude === null) !== (longitude === null)) throw new ApiError(400, "Informe latitude e longitude juntas")

    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        address: optionalText(body.address),
        neighborhood: optionalText(body.neighborhood, 120),
        city: optionalText(body.city, 120),
        state: optionalText(body.state, 2),
        zipCode: optionalText(body.zipCode, 12),
        phone: optionalText(body.phone, 30),
        latitude,
        longitude,
      },
      select: SELECT,
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "UPDATE", entity: "Company", entityId: user.companyId, details: { location: { latitude, longitude, address: company.address } } })
    return Response.json(company)
  } catch (error) {
    return handleApiError(error)
  }
}
