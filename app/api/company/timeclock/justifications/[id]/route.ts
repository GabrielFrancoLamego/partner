import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.timeEntryJustification.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Solicitação não encontrada")

    const body = await request.json()
    const { status, rejectionReason } = body as { status: "APPROVED" | "REJECTED"; rejectionReason?: string }
    if (status !== "APPROVED" && status !== "REJECTED") throw new ApiError(400, "Status inválido")

    const updated = await prisma.timeEntryJustification.update({
      where: { id },
      data: {
        status,
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionReason: status === "REJECTED" ? (rejectionReason ?? "Reprovado pela gerência") : null,
      },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: status, entity: "TimeEntryJustification", entityId: id })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
