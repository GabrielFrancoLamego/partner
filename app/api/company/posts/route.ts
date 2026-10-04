import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const YOUTUBE_VIMEO_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|vimeo\.com\/)/i

function toEmbedUrl(url: string): string {
  const youtubeWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/)
  if (youtubeWatch) return `https://www.youtube.com/embed/${youtubeWatch[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
}

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
      where: { ...where, isHidden: isManager ? undefined : false },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
        likes: { where: { userId: user.id }, select: { id: true } },
        reactions: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return Response.json(
      posts.map((p) => {
        const counts = new Map<string, number>()
        for (const r of p.reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)
        return {
          ...p,
          likes: undefined,
          likedByMe: p.likes.length > 0,
          myReaction: p.reactions.find((r) => r.userId === user.id)?.emoji ?? null,
          reactionCounts: Array.from(counts, ([emoji, count]) => ({ emoji, count })),
          reactions: undefined,
        }
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_ATTACHMENTS = 5

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const formData = await request.formData()
    const title = formData.get("title")
    const content = formData.get("content")
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
    const videoUrlRaw = formData.get("videoUrl")

    if (typeof content !== "string" || !content.trim()) throw new ApiError(400, "Conteúdo é obrigatório")

    let videoUrl: string | null = null
    if (typeof videoUrlRaw === "string" && videoUrlRaw.trim()) {
      if (!YOUTUBE_VIMEO_REGEX.test(videoUrlRaw.trim())) throw new ApiError(400, "Informe um link válido do YouTube ou Vimeo")
      videoUrl = toEmbedUrl(videoUrlRaw.trim())
    }

    if (files.length > MAX_ATTACHMENTS) throw new ApiError(400, `Máximo de ${MAX_ATTACHMENTS} anexos por publicação`)
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) throw new ApiError(400, `Arquivo "${f.name}" excede 20MB`)
      if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(f.type)) {
        throw new ApiError(400, `Formato não suportado em "${f.name}" — envie imagem, vídeo (.mp4), PDF ou Word`)
      }
    }

    let attachmentUrls: string[] = []
    try {
      attachmentUrls = await Promise.all(files.map((f) => uploadImage("posts", f)))
    } catch {
      throw new ApiError(502, "Falha ao enviar os anexos para o servidor de mídia. Tente novamente em instantes.")
    }

    const isManager = canManageDailyOperations(user.role)
    const now = new Date()

    const post = await prisma.post.create({
      data: {
        companyId,
        authorId: user.id,
        title: typeof title === "string" && title.trim() ? title.trim() : null,
        content: content.trim(),
        attachmentUrls,
        videoUrl,
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

    return Response.json({ ...post, likedByMe: false, myReaction: null, reactionCounts: [] }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
