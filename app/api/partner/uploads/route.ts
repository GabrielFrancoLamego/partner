import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { uploadAvatar } from "@/lib/storage"

/** Upload da foto de perfil do Parceiro (Header > Avatar > Foto de Perfil). */
export async function POST(request: Request) {
  try {
    const user = await requirePartner()

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Arquivo obrigatório")
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "Arquivo excede 5MB")

    const url = await uploadAvatar("partner", user.id, "photo", file)
    return Response.json({ url })
  } catch (error) {
    return handleApiError(error)
  }
}
