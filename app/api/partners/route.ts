import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"

/**
 * Busca parceiros por nome/apelido — usado pelo Scanner PDV para indicar quem
 * trouxe o cliente. Parceiros não pertencem a uma única empresa (mesmo motivo
 * de app/api/admin/partners/route.ts não filtrar por companyId), então a
 * busca é igual à do admin, só trocando a autorização.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()
    if (!q) return Response.json([])

    const partners = await prisma.user.findMany({
      where: {
        role: "PARTNER",
        status: "ACTIVE",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { partnerProfile: { fullName: { contains: q, mode: "insensitive" } } },
          { partnerProfile: { nickname: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        partnerProfile: { select: { fullName: true, nickname: true, photoUrl: true } },
      },
      take: 20,
      orderBy: { name: "asc" },
    })

    return Response.json(partners)
  } catch (error) {
    return handleApiError(error)
  }
}
