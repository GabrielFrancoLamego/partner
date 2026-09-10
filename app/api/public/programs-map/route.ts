import { prisma } from "@/lib/prisma"

/** Empresas com Programa de Parceria ATIVO e coordenadas cadastradas — alimenta o mapa público/parceiro. */
export async function GET() {
  const now = new Date()

  const companies = await prisma.company.findMany({
    where: {
      status: "ACTIVE",
      latitude: { not: null },
      longitude: { not: null },
      programs: { some: { active: true } },
    },
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
          productUnitLabel: true,
        },
      },
      _count: {
        select: {
          promotions: { where: { active: true, validFrom: { lte: now }, validUntil: { gte: now } } },
        },
      },
    },
  })

  return Response.json(companies)
}
