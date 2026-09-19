import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { uploadImage, uploadPublicDocument } from "@/lib/storage"

/** Upload genérico de mídia para telas do Admin (Programas, Programa Interno, Promoções — visão cross-tenant). */
export async function POST(request: Request) {
  try {
    await requirePlatformAdmin()

    const formData = await request.formData()
    const kind = formData.get("kind")
    const file = formData.get("file")

    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Arquivo obrigatório")
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "Arquivo excede 5MB")

    let url: string
    if (kind === "program-cover" || kind === "promotion-photo" || kind === "program-level-image") {
      url = await uploadImage("programs", file)
    } else if (kind === "program-pdf") {
      url = await uploadPublicDocument("programs", file)
    } else if (kind === "internal-program-cover" || kind === "internal-level-image") {
      url = await uploadImage("internal-programs", file)
    } else if (kind === "internal-program-pdf") {
      url = await uploadPublicDocument("internal-programs", file)
    } else {
      throw new ApiError(400, "Tipo de upload inválido")
    }

    return Response.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
