import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

const SORT_FIELDS = ["createdAt", "qrGenerated", "qrUsed", "lastActiveAt"] as const
type SortField = (typeof SORT_FIELDS)[number]

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()
    const sort = (searchParams.get("sort") as SortField) ?? "createdAt"
    const order = searchParams.get("order") === "asc" ? "asc" : "desc"

    const partners = await prisma.user.findMany({
      where: {
        role: "PARTNER",
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { partnerProfile: { bio: { contains: q, mode: "insensitive" } } },
                { partnerProfile: { nickname: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        partnerProfile: {
          include: {
            parent: { select: { id: true, user: { select: { name: true } } } },
            currentLevel: { select: { id: true, name: true, badgeColorHex: true } },
          },
        },
      },
      orderBy: SORT_FIELDS.includes(sort) && sort !== "qrGenerated" && sort !== "qrUsed" ? { [sort]: order } : { createdAt: "desc" },
    })

    // Agregações não dão para vir no mesmo findMany (Commission/Referral são
    // relations separadas) — busca em lote e junta em memória.
    const partnerIds = partners.map((p) => p.id)
    const [qrGeneratedRows, qrUsedRows, billedRows, convertedRows, companyRows] = await Promise.all([
      prisma.commission.groupBy({
        by: ["partnerId"],
        where: { partnerId: { in: partnerIds }, qrCodeId: { not: null } },
        _count: { _all: true },
      }),
      prisma.commission.groupBy({
        by: ["partnerId"],
        where: { partnerId: { in: partnerIds }, status: { in: ["APPROVED", "PAID"] } },
        _count: { _all: true },
      }),
      prisma.commission.groupBy({
        by: ["partnerId"],
        where: { partnerId: { in: partnerIds }, status: { in: ["APPROVED", "PAID"] } },
        _sum: { amount: true },
      }),
      prisma.referral.groupBy({
        by: ["partnerId"],
        where: { partnerId: { in: partnerIds }, visited: true },
        _count: { _all: true },
      }),
      // Empresa(s) correspondente(s) — parceiro não tem 1 empresa fixa, atua por indicação (ver Referral/Commission).
      prisma.referral.findMany({
        where: { partnerId: { in: partnerIds } },
        select: { partnerId: true, companyId: true, company: { select: { id: true, name: true } } },
        distinct: ["partnerId", "companyId"],
      }),
    ])

    const toMap = (rows: { partnerId: string; _count?: { _all: number }; _sum?: { amount: unknown } }[]) =>
      new Map(rows.map((r) => [r.partnerId, r]))
    const qrGeneratedMap = toMap(qrGeneratedRows)
    const qrUsedMap = toMap(qrUsedRows)
    const billedMap = toMap(billedRows)
    const convertedMap = toMap(convertedRows)

    const companiesMap = new Map<string, { id: string; name: string }[]>()
    for (const row of companyRows) {
      const list = companiesMap.get(row.partnerId) ?? []
      list.push(row.company)
      companiesMap.set(row.partnerId, list)
    }

    let enriched = partners.map((p) => ({
      ...p,
      companies: companiesMap.get(p.id) ?? [],
      metrics: {
        qrGenerated: qrGeneratedMap.get(p.id)?._count?._all ?? 0,
        qrUsed: qrUsedMap.get(p.id)?._count?._all ?? 0,
        grossRevenueGenerated: Number(billedMap.get(p.id)?._sum?.amount ?? 0),
        convertedReferrals: convertedMap.get(p.id)?._count?._all ?? 0,
      },
    }))

    if (sort === "qrGenerated" || sort === "qrUsed") {
      enriched = enriched.sort((a, b) => {
        const diff = a.metrics[sort] - b.metrics[sort]
        return order === "asc" ? diff : -diff
      })
    }

    return Response.json(enriched)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { email, name, partnerType, document, phone, fullName, nickname, whatsapp, contactEmail, cpf, bio } = body

    if (!email || !name) {
      throw new ApiError(400, "Email e nome são obrigatórios")
    }
    if (!whatsapp) {
      throw new ApiError(400, "WhatsApp é obrigatório")
    }

    const user = await createPlatformUser({
      email,
      name,
      role: "PARTNER",
      partnerType: partnerType ?? "INDIVIDUAL",
      document,
      phone,
      fullName,
      nickname,
      whatsapp,
      contactEmail,
      cpf,
      bio,
    })

    await logAudit({
      userId: admin.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      details: { email, name, role: "PARTNER", partnerType, document, phone, whatsapp },
    })

    return Response.json(user, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
