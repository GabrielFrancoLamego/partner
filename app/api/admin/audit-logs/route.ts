import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")
    const action = searchParams.get("action")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(companyId && companyId !== "all" ? { companyId } : {}),
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return Response.json(logs)
  } catch (error) {
    return handleApiError(error)
  }
}
