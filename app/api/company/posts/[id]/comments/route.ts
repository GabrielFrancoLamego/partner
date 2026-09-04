import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const comments = await prisma.postComment.findMany({
      where: { postId: id },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    })

    return Response.json(comments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id } = await params

    const post = await prisma.post.findFirst({ where: { id, companyId: user.companyId } })
    if (!post) throw new ApiError(404, "Post não encontrado")

    const isManager = canManageDailyOperations(user.role)
    if (post.status !== "PUBLISHED" && post.authorId !== user.id && !isManager) {
      throw new ApiError(403, "Post ainda não publicado")
    }

    const body = await request.json()
    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message) throw new ApiError(400, "Comentário não pode ser vazio")

    const comment = await prisma.postComment.create({
      data: { postId: id, authorId: user.id, message },
      include: { author: { select: { id: true, name: true, role: true } } },
    })

    return Response.json(comment, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
