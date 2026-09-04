import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { uploadEmployeeDocument, getSignedDocumentUrl, type EmployeeDocField } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const VALID_FIELDS: EmployeeDocField[] = ["cpfDocUrl", "rgDocUrl", "proofOfResidenceUrl"]

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()

    const formData = await request.formData()
    const file = formData.get("file")
    const userId = formData.get("userId")
    const field = formData.get("field")

    if (!(file instanceof File)) throw new ApiError(400, "Arquivo é obrigatório")
    if (typeof userId !== "string" || !userId) throw new ApiError(400, "userId é obrigatório")
    if (typeof field !== "string" || !VALID_FIELDS.includes(field as EmployeeDocField)) {
      throw new ApiError(400, "Campo de documento inválido")
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
      include: { user: { select: { companyId: true } } },
    })
    if (!profile) throw new ApiError(404, "Colaborador sem perfil de RH (não é EMPLOYEE)")

    const path = await uploadEmployeeDocument(userId, field as EmployeeDocField, file)

    await prisma.employeeProfile.update({
      where: { userId },
      data: { [field]: path },
    })

    await logAudit({
      userId: admin.id,
      companyId: profile.user.companyId,
      action: "UPDATE",
      entity: "EmployeeProfile",
      entityId: userId,
      details: { field, fileName: file.name, fileSize: file.size },
    })

    // URL de curta duração só para o preview imediato pós-upload — o que
    // fica salvo no banco é `path`, não esta URL.
    const previewUrl = await getSignedDocumentUrl(path)

    return Response.json({ path, url: previewUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
