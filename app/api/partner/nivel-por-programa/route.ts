import { requirePartner, handleApiError } from "@/lib/api-auth"
import { computePartnerProgramLevels } from "@/lib/partner-program-levels"

/** "Meu Nível" — régua de nível calculada individualmente por Programa/Empresa (ver lib/partner-program-levels.ts). */
export async function GET() {
  try {
    const user = await requirePartner()
    const progress = await computePartnerProgramLevels(user.id)
    return Response.json(progress)
  } catch (error) {
    return handleApiError(error)
  }
}
