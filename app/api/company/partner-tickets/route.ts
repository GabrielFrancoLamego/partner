import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

/**
 * Inbox de chamados abertos por PARCEIROS endereçados à própria empresa (ver
 * balão de Ajuda flutuante em /partner, "Falar com o Estabelecimento") —
 * distinto de /api/company/tickets (que são os chamados que a PRÓPRIA
 * empresa abre com o Suporte da Plataforma). Master/Gerente respondem.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)

    const tickets = await prisma.ticket.findMany({
      where: { companyId: user.companyId, author: { role: "PARTNER" } },
      include: {
        author: { select: { id: true, name: true, role: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    })

    return Response.json(tickets)
  } catch (error) {
    return handleApiError(error)
  }
}
