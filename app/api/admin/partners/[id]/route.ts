import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { deleteAuthUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const {
      name,
      status,
      partnerType,
      document,
      phone,
      pixKey,
      fullName,
      nickname,
      whatsapp,
      email: contactEmail,
      cpf,
      bio,
    } = body

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
        partnerProfile: {
          update: {
            ...(partnerType !== undefined ? { partnerType } : {}),
            ...(document !== undefined ? { document } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(pixKey !== undefined ? { pixKey } : {}),
            ...(fullName !== undefined ? { fullName } : {}),
            ...(nickname !== undefined ? { nickname: nickname || null } : {}),
            ...(whatsapp !== undefined ? { whatsapp } : {}),
            ...(contactEmail !== undefined ? { email: contactEmail } : {}),
            ...(cpf !== undefined ? { cpf: cpf || null } : {}),
            ...(bio !== undefined ? { bio } : {}),
          },
        },
      },
      include: { partnerProfile: true },
    })

    await logAudit({
      userId: admin.id,
      action: status !== undefined ? (status === "INACTIVE" ? "BLOCK" : "UNBLOCK") : "UPDATE",
      entity: "User",
      entityId: id,
      details: body,
    })

    return Response.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    await prisma.user.delete({ where: { id } })
    await deleteAuthUser(id)

    await logAudit({ userId: admin.id, action: "DELETE", entity: "User", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
