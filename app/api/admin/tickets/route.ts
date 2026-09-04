import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")
    const q = searchParams.get("q")

    const tickets = await prisma.ticket.findMany({
      where: {
        ...(companyId && companyId !== "all" ? { companyId } : {}),
        ...(status ? { status: status as "OPEN" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED" } : {}),
        ...(q ? { subject: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })

    return Response.json(tickets)
  } catch (error) {
    return handleApiError(error)
  }
}
