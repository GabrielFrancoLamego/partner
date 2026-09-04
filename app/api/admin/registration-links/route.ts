import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"

export async function GET() {
  try {
    await requirePlatformAdmin()

    const links = await prisma.publicRegistrationLink.findMany({
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(links)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { companyId, role } = body

    if (!companyId) throw new ApiError(400, "Empresa é obrigatória")

    const link = await prisma.publicRegistrationLink.create({
      data: { companyId, role: role ?? "EMPLOYEE", createdById: admin.id },
    })

    return Response.json(link, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
