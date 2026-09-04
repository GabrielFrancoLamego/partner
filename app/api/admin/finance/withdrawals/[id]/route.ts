import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { status, rejectionReason } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, "Status inválido")
    }

    const withdrawal = await prisma.withdrawal.update({
      where: { id },
      data: {
        status,
        ...(status === "REJECTED" ? { rejectionReason } : {}),
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: withdrawal.companyId,
      action: "PIX_APPROVAL",
      entity: "Withdrawal",
      entityId: id,
      details: { status, rejectionReason },
    })

    return Response.json(withdrawal)
  } catch (error) {
    return handleApiError(error)
  }
}
