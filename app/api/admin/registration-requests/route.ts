import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const requests = await prisma.publicRegistrationRequest.findMany({
      where: status ? { status: status as "PENDING_APPROVAL" | "APPROVED" | "REJECTED" } : {},
      include: {
        company: { select: { id: true, name: true } },
        link: { select: { role: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(requests)
  } catch (error) {
    return handleApiError(error)
  }
}
