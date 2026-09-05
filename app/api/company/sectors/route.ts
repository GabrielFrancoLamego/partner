import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const sectors = await prisma.sector.findMany({
      where: { companyId: user.companyId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    })
    return Response.json(sectors)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { name, description } = body
    if (!name?.trim()) throw new ApiError(400, "Nome do setor é obrigatório")

    const sector = await prisma.sector.create({ data: { companyId, name: name.trim(), description: description || null } })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "Sector", entityId: sector.id, details: body })

    return Response.json(sector, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
