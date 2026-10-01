import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Lista de Fechamentos Diários já efetuados — visível a Gerente e Master
 * (leitura); só o Master pode de fato corrigir um fechamento já COMPLETED
 * (ver POST /api/company/shift-closing, que reforça essa regra separadamente).
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const fromRaw = searchParams.get("from")
    const toRaw = searchParams.get("to")
    const from = startOfDay(fromRaw ? new Date(fromRaw) : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
    const to = new Date(startOfDay(toRaw ? new Date(toRaw) : new Date()).getTime() + 24 * 60 * 60 * 1000)

    const closings = await prisma.shiftClosing.findMany({
      where: { companyId, date: { gte: from, lt: to } },
      include: { closedBy: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      take: 90,
    })

    return Response.json(closings)
  } catch (error) {
    return handleApiError(error)
  }
}
