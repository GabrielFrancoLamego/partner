import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { lookupCep } from "@/lib/geocode"
import { isValidCep } from "@/lib/validators"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = new URL(request.url)
    const cep = searchParams.get("cep") ?? ""

    if (!isValidCep(cep)) throw new ApiError(400, "CEP inválido")

    const result = await lookupCep(cep)
    if (!result) throw new ApiError(404, "CEP não encontrado")

    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
