import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { uploadAvatar, type AvatarOwnerType } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const FIELDS_BY_OWNER: Record<AvatarOwnerType, string[]> = {
  company: ["profilePictureUrl", "coverPictureUrl", "logoWithLabelUrl"],
  employee: ["photoUrl"],
  partner: ["photoUrl"],
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()

    const formData = await request.formData()
    const file = formData.get("file")
    const ownerType = formData.get("ownerType")
    const ownerId = formData.get("ownerId")
    const field = formData.get("field")

    if (!(file instanceof File)) throw new ApiError(400, "Arquivo é obrigatório")
    if (typeof ownerType !== "string" || !(ownerType in FIELDS_BY_OWNER)) {
      throw new ApiError(400, "ownerType inválido")
    }
    if (typeof ownerId !== "string" || !ownerId) throw new ApiError(400, "ownerId é obrigatório")
    if (typeof field !== "string" || !FIELDS_BY_OWNER[ownerType as AvatarOwnerType].includes(field)) {
      throw new ApiError(400, "Campo inválido para este tipo de dono")
    }

    const url = await uploadAvatar(ownerType as AvatarOwnerType, ownerId, field, file)

    let companyId: string | null = null

    if (ownerType === "company") {
      await prisma.company.update({ where: { id: ownerId }, data: { [field]: url } })
      companyId = ownerId
    } else if (ownerType === "employee") {
      const profile = await prisma.employeeProfile.update({
        where: { userId: ownerId },
        data: { [field]: url },
        include: { user: { select: { companyId: true } } },
      })
      companyId = profile.user.companyId
    } else {
      await prisma.partnerProfile.update({ where: { userId: ownerId }, data: { [field]: url } })
    }

    await logAudit({
      userId: admin.id,
      companyId,
      action: "UPDATE",
      entity: ownerType === "company" ? "Company" : ownerType === "employee" ? "EmployeeProfile" : "PartnerProfile",
      entityId: ownerId,
      details: { field, fileName: file.name, fileSize: file.size },
    })

    return Response.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
