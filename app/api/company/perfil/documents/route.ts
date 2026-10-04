import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { uploadEmployeeDocument, getSignedDocumentUrl, type EmployeeDocField } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const VALID_FIELDS: EmployeeDocField[] = ["cpfDocUrl", "rgDocUrl", "proofOfResidenceUrl", "voterCardDocUrl", "militaryCertificateDocUrl", "pisDocUrl"]

/**
 * Upload de um documento pessoal do PRÓPRIO colaborador (seção "Documentos
 * Pessoais" em /company/perfil) — diferente de app/api/admin/employees/upload,
 * que é o Admin da plataforma preenchendo por outra pessoa. Mesmo bucket
 * privado (employee-documents, ver lib/storage.ts), mesmo padrão de path.
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    if (user.role !== "EMPLOYEE") throw new ApiError(403, "Sem permissão para esta ação")

    const formData = await request.formData()
    const file = formData.get("file")
    const field = formData.get("field")

    if (!(file instanceof File)) throw new ApiError(400, "Arquivo é obrigatório")
    if (typeof field !== "string" || !VALID_FIELDS.includes(field as EmployeeDocField)) {
      throw new ApiError(400, "Campo de documento inválido")
    }

    const path = await uploadEmployeeDocument(user.id, field as EmployeeDocField, file)

    await prisma.employeeProfile.update({ where: { userId: user.id }, data: { [field]: path } })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "UPDATE",
      entity: "EmployeeProfile",
      entityId: user.id,
      details: { field, fileName: file.name, fileSize: file.size },
    })

    const previewUrl = await getSignedDocumentUrl(path)
    return Response.json({ path, url: previewUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
