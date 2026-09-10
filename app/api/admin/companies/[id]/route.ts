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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { name, slug, status, blockReason } = body

    if (status !== undefined) {
      const current = await prisma.company.findUnique({ where: { id }, select: { status: true } })
      if (!current) throw new ApiError(404, "Empresa não encontrada")
      if (status !== current.status && !blockReason?.trim()) {
        throw new ApiError(400, "Motivo é obrigatório para bloquear/desbloquear uma empresa")
      }
    }

    const profileData: Record<string, unknown> = {}
    for (const field of COMPANY_PROFILE_FIELDS) {
      if (body[field] !== undefined) profileData[field] = body[field]
    }

    const before = await prisma.company.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, "Empresa não encontrada")

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(status !== undefined ? { status } : {}),
        ...profileData,
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: id,
      action: status !== undefined ? (status === "INACTIVE" ? "BLOCK" : "UNBLOCK") : "UPDATE",
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    if (id === admin.companyId) {
      throw new ApiError(400, "Não é possível excluir a própria empresa")
    }

    await prisma.company.delete({ where: { id } })

    await logAudit({ userId: admin.id, action: "DELETE", entity: "Company", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
