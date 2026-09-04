import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")

    const checklists = await prisma.checklist.findMany({
      where: {
        ...(companyId && companyId !== "all" ? { companyId } : {}),
        ...(status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {}),
        ...(priority ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        template: { select: { id: true, title: true, recurrence: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return Response.json(checklists)
  } catch (error) {
    return handleApiError(error)
  }
}
