import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { getSignedDocumentUrl, type EmployeeDocField } from "@/lib/storage"

const VALID_FIELDS: EmployeeDocField[] = ["cpfDocUrl", "rgDocUrl", "proofOfResidenceUrl", "voterCardDocUrl", "militaryCertificateDocUrl", "pisDocUrl"]

/** Signed URL de curta duração pro PRÓPRIO colaborador visualizar um documento já enviado. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    if (user.role !== "EMPLOYEE") throw new ApiError(403, "Sem permissão para esta ação")

    const { searchParams } = new URL(request.url)
    const field = searchParams.get("field")
    if (!field || !VALID_FIELDS.includes(field as EmployeeDocField)) throw new ApiError(400, "Campo de documento inválido")

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, "Perfil não encontrado")

    const path = (profile as unknown as Record<string, string | null>)[field]
    if (!path) throw new ApiError(404, "Nenhum arquivo enviado para este campo")

    const url = await getSignedDocumentUrl(path)
    return Response.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
