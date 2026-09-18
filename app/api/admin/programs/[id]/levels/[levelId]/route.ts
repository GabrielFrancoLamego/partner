import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; levelId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id: programId, levelId } = await params

    const level = await prisma.programLevel.findFirst({ where: { id: levelId, programId }, include: { program: true } })
    if (!level) throw new ApiError(404, "Nível não encontrado")

    await prisma.programLevel.delete({ where: { id: levelId } })
    await logAudit({
      userId: admin.id,
      companyId: level.program.companyId,
      action: "DELETE",
      entity: "ProgramLevel",
      entityId: levelId,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
