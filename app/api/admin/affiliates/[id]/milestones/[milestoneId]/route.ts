import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    await requirePlatformAdmin()
    const { id, milestoneId } = await params

    const milestone = await prisma.affiliateMilestone.findUnique({ where: { id: milestoneId } })
    if (!milestone || milestone.affiliateId !== id) throw new ApiError(404, "Marco não encontrado")

    await prisma.affiliateMilestone.delete({ where: { id: milestoneId } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
