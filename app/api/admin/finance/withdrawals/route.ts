import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        ...(companyId && companyId !== "all" ? { companyId } : {}),
        ...(status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" | "PAID" } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { requestDate: "desc" },
      take: 200,
    })

    return Response.json(withdrawals)
  } catch (error) {
    return handleApiError(error)
  }
}
