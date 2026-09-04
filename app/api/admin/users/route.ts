import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

/** Usuários "internos" (não-parceiro): ADMIN + staff de empresa. */
const STAFF_ROLES = ["ADMIN", "COMPANY_MASTER", "COMPANY_GERENTE", "COMPANY_FINANCE", "EMPLOYEE"] as const

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const role = searchParams.get("role")

    const users = await prisma.user.findMany({
      where: {
        role: role ? (role as (typeof STAFF_ROLES)[number]) : { in: [...STAFF_ROLES] },
        ...(companyId && companyId !== "all" ? { companyId } : {}),
      },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(users)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { email, name, role, companyId } = body

    if (!email || !name || !role) {
      throw new ApiError(400, "Email, nome e papel são obrigatórios")
    }
    if (!STAFF_ROLES.includes(role)) {
      throw new ApiError(400, "Papel inválido para esta tela")
    }
    if (role !== "ADMIN" && !companyId) {
      throw new ApiError(400, "Empresa é obrigatória para este papel")
    }

    const user = await createPlatformUser({
      email,
      name,
      role,
      companyId: role === "ADMIN" ? null : companyId,
    })

    await logAudit({
      userId: admin.id,
      companyId: user.companyId,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      details: { email, name, role, companyId },
    })

    return Response.json(user, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
