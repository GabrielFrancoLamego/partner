import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"

/** Alterna curtida do usuário logado no post. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    })

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } })
    } else {
      await prisma.postLike.create({ data: { postId: id, userId: user.id } })
    }

    const count = await prisma.postLike.count({ where: { postId: id } })
    return Response.json({ liked: !existing, count })
  } catch (error) {
    return handleApiError(error)
  }
}
