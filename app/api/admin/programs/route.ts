import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const programs = await prisma.program.findMany({
      where: companyId && companyId !== "all" ? { companyId } : {},
      include: {
        company: { select: { id: true, name: true } },
        levels: { orderBy: { order: "asc" } },
        _count: { select: { referrals: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(programs)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { companyId, name, description, commissionType, commissionValue, isPercentage } = body

    if (!companyId || !name || !commissionType || commissionValue === undefined) {
      throw new ApiError(400, "Empresa, nome, tipo e valor de comissão são obrigatórios")
    }

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId })
    const program = await db.program.create({
      data: {
        companyId,
        name,
        description: description ?? "",
        commissionType,
        commissionValue,
        isPercentage: isPercentage ?? false,
      },
    })

    return Response.json(program, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
