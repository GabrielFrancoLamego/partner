import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    await requirePlatformAdmin()

    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: {
        license: true,
        _count: { select: { users: true, units: true, programs: true, promotions: true } },
      },
    })

    return Response.json(companies)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()

    const body = await request.json()
    const { name, slug } = body

    if (!name || !slug) {
      throw new ApiError(400, "Nome e slug são obrigatórios")
    }

    const company = await prisma.company.create({
      data: { name, slug, license: { create: {} } },
      include: { license: true },
    })

    await logAudit({
      userId: admin.id,
      companyId: company.id,
      action: "CREATE",
      entity: "Company",
      entityId: company.id,
      details: { name, slug },
    })

    return Response.json(company, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
