import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { generatePasswordResetLink } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new ApiError(404, "Usuário não encontrado")

    const resetLink = await generatePasswordResetLink(user.email)

    await logAudit({
      userId: admin.id,
      companyId: user.companyId,
      action: "PASSWORD_RESET_TRIGGERED",
      entity: "User",
      entityId: id,
    })

    return Response.json({ resetLink })
  } catch (error) {
    return handleApiError(error)
  }
}
