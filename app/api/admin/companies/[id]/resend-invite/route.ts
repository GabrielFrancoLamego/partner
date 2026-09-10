import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { generatePasswordResetLink } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

/** Reenvia (gera novo) o link de ativação/acesso para o Master da empresa. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const master = await prisma.user.findFirst({
      where: { companyId: id, role: "COMPANY_MASTER" },
      orderBy: { createdAt: "asc" },
    })
    if (!master) throw new ApiError(404, "Nenhum usuário Master encontrado para esta empresa")

    const inviteLink = await generatePasswordResetLink(master.email)

    await logAudit({
      userId: admin.id,
      companyId: id,
      action: "RESEND_INVITE",
      entity: "User",
      entityId: master.id,
      details: { email: master.email },
    })

    return Response.json({ inviteLink, masterEmail: master.email })
  } catch (error) {
    return handleApiError(error)
  }
}
