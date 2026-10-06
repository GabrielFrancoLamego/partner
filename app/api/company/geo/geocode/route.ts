import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { geocodeAddress } from "@/lib/geocode"

/** Localiza um endereço digitado no mapa (Nominatim/OpenStreetMap) — o gestor ajusta o pin depois. */
export async function GET(request: Request) {
  try {
    await requireCompanyStaff()
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
    if (q.length < 5) throw new ApiError(400, "Informe o endereço para localizar")
    const result = await geocodeAddress(q)
    if (!result) throw new ApiError(404, "Endereço não localizado — posicione o pin manualmente no mapa")
    return Response.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
