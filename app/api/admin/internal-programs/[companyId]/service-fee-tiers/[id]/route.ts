import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function DELETE(_request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId, id } = await params

    const tier = await prisma.internalServiceFeeTier.findFirst({ where: { id, internalProgram: { companyId } } })
    if (!tier) throw new ApiError(404, "Faixa não encontrada")

    await prisma.internalServiceFeeTier.delete({ where: { id } })
    await logAudit({ userId: admin.id, companyId, action: "DELETE", entity: "InternalServiceFeeTier", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
