import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const units = await prisma.unit.findMany({
      where: companyId && companyId !== "all" ? { companyId } : {},
      select: { id: true, name: true, companyId: true },
      orderBy: { name: "asc" },
    })

    return Response.json(units)
  } catch (error) {
    return handleApiError(error)
  }
}
