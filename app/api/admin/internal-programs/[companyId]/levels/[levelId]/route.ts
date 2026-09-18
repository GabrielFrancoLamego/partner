import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function DELETE(_request: Request, { params }: { params: Promise<{ companyId: string; levelId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId, levelId } = await params

    const level = await prisma.internalLevelRule.findFirst({ where: { id: levelId, internalProgram: { companyId } } })
    if (!level) throw new ApiError(404, "Nível não encontrado")

    await prisma.internalLevelRule.delete({ where: { id: levelId } })
    await logAudit({ userId: admin.id, companyId, action: "DELETE", entity: "InternalLevelRule", entityId: levelId })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
