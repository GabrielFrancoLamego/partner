import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError } from "@/lib/api-auth"

/**
 * Versão autenticada do mapa de programas — mesma base do público
 * (/api/public/programs-map), mas já traz o `programId` (pra chamar
 * "Aderir" direto no popup) e o status de membership do parceiro logado em
 * cada programa (ver components/partner/partner-programs-map.tsx).
 */
export async function GET() {
  try {
    const user = await requirePartner()
    const now = new Date()

    const companies = await prisma.company.findMany({
      where: { status: "ACTIVE", latitude: { not: null }, longitude: { not: null }, programs: { some: { active: true } } },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        neighborhood: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        profilePictureUrl: true,
        coverPictureUrl: true,
        programs: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            description: true,
            commissionType: true,
            commissionValue: true,
            commissionFormat: true,
            fixedValue: true,
            productUnitLabel: true,
            status: true,
            memberships: { where: { partnerId: user.id }, select: { status: true }, take: 1 },
          },
        },
        _count: {
          select: { promotions: { where: { active: true, validFrom: { lte: now }, validUntil: { gte: now } } } },
        },
      },
    })

    return Response.json(
      companies.map((c) => ({
        ...c,
        programs: c.programs.map((p) => ({
          ...p,
          membershipStatus: p.memberships[0]?.status ?? null,
          memberships: undefined,
        })),
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
