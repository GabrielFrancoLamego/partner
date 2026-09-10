import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { uploadImage, uploadPublicDocument } from "@/lib/storage"

/** Upload genérico de mídia do Programa de Parceria / Promoções da própria empresa. */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)

    const formData = await request.formData()
    const kind = formData.get("kind")
    const file = formData.get("file")

    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Arquivo obrigatório")
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "Arquivo excede 5MB")

    let url: string
    if (kind === "program-cover" || kind === "promotion-photo") {
      url = await uploadImage("programs", file)
    } else if (kind === "program-pdf") {
      url = await uploadPublicDocument("programs", file)
    } else {
      throw new ApiError(400, "Tipo de upload inválido")
    }

    return Response.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
