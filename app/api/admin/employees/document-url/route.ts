import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { getSignedDocumentUrl, type EmployeeDocField } from "@/lib/storage"

const VALID_FIELDS: EmployeeDocField[] = ["cpfDocUrl", "rgDocUrl", "proofOfResidenceUrl"]

/** Gera uma signed URL de curta duração (60 min) para um documento já salvo — chamada ao clicar em "Visualizar Documento". */
export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const field = searchParams.get("field")

    if (!userId || !field || !VALID_FIELDS.includes(field as EmployeeDocField)) {
      throw new ApiError(400, "userId e field são obrigatórios")
    }

    const profile = await prisma.employeeProfile.findUnique({ where: { userId } })
    if (!profile) throw new ApiError(404, "Colaborador sem perfil de RH")

    const path = (profile as unknown as Record<string, string | null>)[field]
    if (!path) throw new ApiError(404, "Nenhum arquivo enviado para este campo")

    const url = await getSignedDocumentUrl(path)
    return Response.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
