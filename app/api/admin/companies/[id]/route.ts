import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

/** Campos de cadastro completo aceitos no PATCH — além de name/slug/status. */
const COMPANY_PROFILE_FIELDS = [
  "tradeName",
  "corporateName",
  "cnpj",
  "address",
  "neighborhood",
  "city",
  "state",
  "segment",
  "zipCode",
  "latitude",
  "longitude",
  "geofenceRadiusMeters",
  "shiftClosingDeadline",
  "operatingShift1Start",
  "operatingShift1End",
  "operatingShift2Start",
  "operatingShift2End",
  "phone",
  "email",
  "website",
  "socialLinks",
  "shortDescription",
  "profilePictureUrl",
  "coverPictureUrl",
  "logoWithLabelUrl",
] as const

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "OVERDUE", "BLOCKED", "ARCHIVED"] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { name, slug, status, blockReason } = body

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, "Status inválido")
    }

    if (status !== undefined) {
      const current = await prisma.company.findUnique({ where: { id }, select: { status: true } })
      if (!current) throw new ApiError(404, "Empresa não encontrada")
      if (status !== current.status && !blockReason?.trim()) {
        throw new ApiError(400, "Motivo é obrigatório para alterar o status de uma empresa")
      }
    }

    const profileData: Record<string, unknown> = {}
    for (const field of COMPANY_PROFILE_FIELDS) {
      if (body[field] !== undefined) profileData[field] = body[field]
    }

    const before = await prisma.company.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, "Empresa não encontrada")

    // OVERDUE liga overdueSince (início da carência de 15 dias, ver
    // lib/company-access.ts) na primeira vez que entra nesse status; sair de
    // OVERDUE limpa o marcador. ARCHIVED também seta isArchived/archivedAt —
    // mesma ação de "Arquivar" disparada pelo DELETE abaixo.
    const statusExtra: Record<string, unknown> = {}
    if (status !== undefined && status !== before.status) {
      statusExtra.statusReason = blockReason ?? null
      if (status === "OVERDUE" && before.status !== "OVERDUE") statusExtra.overdueSince = new Date()
      if (status !== "OVERDUE") statusExtra.overdueSince = null
      if (status === "ARCHIVED") {
        statusExtra.isArchived = true
        statusExtra.archivedAt = new Date()
      } else if (before.status === "ARCHIVED") {
        statusExtra.isArchived = false
        statusExtra.archivedAt = null
      }
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(status !== undefined ? { status } : {}),
        ...statusExtra,
        ...profileData,
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: id,
      action: status !== undefined ? "CHANGE_STATUS" : "UPDATE",
      entity: "Company",
      entityId: id,
      details:
        status !== undefined
          ? { before: { status: before.status }, after: { status: company.status }, reason: blockReason ?? null }
          : { before, after: company },
    })

    return Response.json(company)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * "Excluir" no Admin nunca apaga dados — só arquiva logicamente
 * (isArchived + status ARCHIVED). Uma empresa arquivada perde acesso
 * (ver lib/company-access.ts) mas todo o histórico permanece no banco.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    if (id === admin.companyId) {
      throw new ApiError(400, "Não é possível arquivar a própria empresa")
    }

    const before = await prisma.company.findUnique({ where: { id }, select: { status: true, isArchived: true } })
    if (!before) throw new ApiError(404, "Empresa não encontrada")

    const company = await prisma.company.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date(), status: "ARCHIVED", overdueSince: null },
    })

    await logAudit({
      userId: admin.id,
      companyId: id,
      action: "ARCHIVE",
      entity: "Company",
      entityId: id,
      details: { before },
    })

    return Response.json(company)
  } catch (error) {
    return handleApiError(error)
  }
}
