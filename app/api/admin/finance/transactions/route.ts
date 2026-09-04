import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const transactions = await prisma.walletTransaction.findMany({
      where: companyId && companyId !== "all" ? { companyId } : {},
      include: {
        company: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return Response.json(transactions)
  } catch (error) {
    return handleApiError(error)
  }
}
