import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

/**
 * Mural — Gerente/Master veem tudo (inclusive pendentes de outros autores
 * para moderar); demais colaboradores veem publicados + os próprios posts
 * em qualquer status (para acompanhar se foram aprovados/reprovados).
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const isManager = canManageDailyOperations(user.role)

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope")

    const where =
      isManager && scope === "pending"
        ? { companyId, status: "PENDING_APPROVAL" as const }
        : isManager
          ? { companyId }
          : { companyId, OR: [{ status: "PUBLISHED" as const }, { authorId: user.id }] }

    const posts = await prisma.post.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
        likes: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return Response.json(
      posts.map((p) => ({
        ...p,
        likes: undefined,
        likedByMe: p.likes.length > 0,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const formData = await request.formData()
    const title = formData.get("title")
    const content = formData.get("content")
    const file = formData.get("file")

    if (typeof content !== "string" || !content.trim()) throw new ApiError(400, "Conteúdo é obrigatório")

    const imageUrl = file instanceof File && file.size > 0 ? await uploadImage("posts", file) : null
    const isManager = canManageDailyOperations(user.role)
    const now = new Date()

    const post = await prisma.post.create({
      data: {
        companyId,
        authorId: user.id,
        title: typeof title === "string" && title.trim() ? title.trim() : null,
        content: content.trim(),
        imageUrl,
        status: isManager ? "PUBLISHED" : "PENDING_APPROVAL",
        publishedAt: isManager ? now : null,
        reviewedById: isManager ? user.id : null,
        reviewedAt: isManager ? now : null,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    })

    if (canManageDailyOperations(user.role)) {
      await logAudit({
        userId: user.id,
        companyId,
        action: "CREATE",
        entity: "Post",
        entityId: post.id,
        details: { title, autoPublished: true },
      })
    }

    return Response.json({ ...post, likedByMe: false }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
