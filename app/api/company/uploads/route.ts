import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany, canManageDailyOperations } from "@/lib/permissions"
import { uploadImage, uploadPublicDocument } from "@/lib/storage"

const INTERNAL_PROGRAM_KINDS = new Set(["internal-program-cover", "internal-program-pdf", "internal-level-image"])

/** Upload genérico de mídia do Programa de Parceria / Promoções / Programa Interno da própria empresa. */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()

    const formData = await request.formData()
    const kind = formData.get("kind")
    const file = formData.get("file")

    // Programa Interno é gerenciado por Master+Gerente (canManageDailyOperations);
    // Programa de Parceria/Promoções seguem restritos a Master (canConfigureCompany).
    requireCapability(user, typeof kind === "string" && INTERNAL_PROGRAM_KINDS.has(kind) ? canManageDailyOperations : canConfigureCompany)

    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Arquivo obrigatório")
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "Arquivo excede 5MB")

    let url: string
    if (kind === "program-cover" || kind === "promotion-photo") {
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
