import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"

const ALLOWED_EMOJIS = new Set(["👍", "❤️", "😂", "😮", "👏", "🎉"])

/** Define/troca a reação em emoji do usuário logado no post — 1 emoji por pessoa por post. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const body = await request.json()
    const emoji = typeof body?.emoji === "string" ? body.emoji : ""
    if (!ALLOWED_EMOJIS.has(emoji)) throw new ApiError(400, "Reação inválida")

    await prisma.postReaction.upsert({
      where: { postId_userId: { postId: id, userId: user.id } },
      update: { emoji },
      create: { postId: id, userId: user.id, emoji },
    })

    const reactions = await prisma.postReaction.groupBy({ by: ["emoji"], where: { postId: id }, _count: { emoji: true } })
    return Response.json({ myEmoji: emoji, counts: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Remove a reação do usuário logado no post. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    await prisma.postReaction.deleteMany({ where: { postId: id, userId: user.id } })

    const reactions = await prisma.postReaction.groupBy({ by: ["emoji"], where: { postId: id }, _count: { emoji: true } })
    return Response.json({ myEmoji: null, counts: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })) })
  } catch (error) {
    return handleApiError(error)
  }
}
