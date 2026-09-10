import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { getPlanCatalog } from "@/lib/plan-catalog"
import { PLAN_IDS } from "@/lib/plans"

export async function GET() {
  try {
    await requirePlatformAdmin()
    const catalog = await getPlanCatalog()
    return Response.json(PLAN_IDS.map((id) => catalog[id]))
  } catch (error) {
    return handleApiError(error)
  }
}
