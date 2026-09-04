import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/** Aprovar/reprovar um post pendente — exclusivo de Gerente/Master. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const body = await request.json()
    const { status, rejectionReason } = body
    if (status !== "PUBLISHED" && status !== "REJECTED") throw new ApiError(400, "Status inválido")

    const now = new Date()
    const updated = await prisma.post.update({
      where: { id },
      data: {
        status,
        reviewedById: user.id,
        reviewedAt: now,
        publishedAt: status === "PUBLISHED" ? now : null,
        rejectionReason: status === "REJECTED" ? (rejectionReason ?? "Reprovado pela gerência") : null,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: status === "PUBLISHED" ? "APPROVE" : "REJECT",
      entity: "Post",
      entityId: id,
      details: { rejectionReason },
    })

    return Response.json({ ...updated, likedByMe: false })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Exclui um post — autor (só enquanto pendente) ou Gerente/Master a qualquer momento. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const isManager = canManageDailyOperations(user.role)
    const isOwnPending = post.authorId === user.id && post.status === "PENDING_APPROVAL"
    if (!isManager && !isOwnPending) throw new ApiError(403, "Sem permissão para excluir este post")

    await prisma.post.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
