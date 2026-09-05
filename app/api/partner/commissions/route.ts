import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"

/** Extrato completo das próprias comissões — o parceiro só vê o que é dele. */
export async function GET(request: Request) {
  try {
    const user = await requirePartner()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const commissions = await prisma.commission.findMany({
      where: {
        partnerId: user.id,
        ...(status && status !== "all"
          ? { status: status as "AWAITING_VALUE" | "PENDING" | "APPROVED" | "PAID" | "REJECTED" }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        promotion: { select: { id: true, title: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    })

    return Response.json(commissions)
  } catch (error) {
    return handleApiError(error)
  }
}
