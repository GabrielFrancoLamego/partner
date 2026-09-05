import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

/** Campos de cadastro completo aceitos no PATCH — além de name/slug/status. */
const COMPANY_PROFILE_FIELDS = [
  "tradeName",
  "corporateName",
  "cnpj",
  "address",
  "city",
  "state",
  "zipCode",
  "latitude",
  "longitude",
  "geofenceRadiusMeters",
  "shiftClosingDeadline",
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
    const { name, slug, status } = body

    const profileData: Record<string, unknown> = {}
    for (const field of COMPANY_PROFILE_FIELDS) {
      if (body[field] !== undefined) profileData[field] = body[field]
    }

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
      details: body,
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
