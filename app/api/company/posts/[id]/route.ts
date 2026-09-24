import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, isCompanyMasterOrAdmin } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/** Aprovar/reprovar (Gerente/Master) ou ocultar/reexibir (Master ou o próprio Autor) um post. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const body = await request.json()

    // Ocultar/reexibir — Master ou o próprio Autor, a qualquer momento.
    if (typeof body.isHidden === "boolean") {
      const canModerate = isCompanyMasterOrAdmin(user.role) || post.authorId === user.id
      if (!canModerate) throw new ApiError(403, "Sem permissão para ocultar este post")

      const updated = await prisma.post.update({
        where: { id },
        data: body.isHidden
          ? { isHidden: true, hiddenById: user.id, hiddenAt: new Date() }
          : { isHidden: false, hiddenById: null, hiddenAt: null },
        include: {
          author: { select: { id: true, name: true, role: true } },
          reviewedBy: { select: { id: true, name: true } },
          _count: { select: { likes: true, comments: true } },
        },
      })
      return Response.json({ ...updated, likedByMe: false })
    }

    requireCapability(user, canManageDailyOperations)
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

/**
 * Exclui um post. Enquanto PENDING_APPROVAL, o próprio autor pode excluir
 * (desiste do post antes da revisão). Depois de publicado, só o Master e o
 * Autor podem excluir — a Gerente pode aprovar/reprovar mas não apagar
 * publicações de terceiros (ver PATCH acima para o "ocultar" reversível).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const isOwn = post.authorId === user.id
    const isOwnPending = isOwn && post.status === "PENDING_APPROVAL"
    const canDeleteAny = isCompanyMasterOrAdmin(user.role) || isOwn
    if (!canDeleteAny && !isOwnPending) throw new ApiError(403, "Sem permissão para excluir este post")

    await prisma.post.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
