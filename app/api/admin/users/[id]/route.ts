import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { deleteAuthUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { name, role, companyId, status } = body

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(companyId !== undefined ? { companyId } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: user.companyId,
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    if (id === admin.id) {
      throw new ApiError(400, "Não é possível excluir seu próprio usuário")
    }

    const deleted = await prisma.user.delete({ where: { id } })
    await deleteAuthUser(id)

    await logAudit({ userId: admin.id, companyId: deleted.companyId, action: "DELETE", entity: "User", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
