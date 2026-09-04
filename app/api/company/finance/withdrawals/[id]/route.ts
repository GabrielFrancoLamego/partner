import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageFinance } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const VALID_STATUSES = ["APPROVED", "REJECTED", "PAID"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageFinance)
    const { id } = await params

    const existing = await prisma.withdrawal.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Saque não encontrado")

    const body = await request.json()
    const { status, rejectionReason } = body
    if (!status || !VALID_STATUSES.includes(status)) throw new ApiError(400, "Status inválido")

    const withdrawal = await prisma.withdrawal.update({
      where: { id },
      data: {
        status,
        ...(status === "REJECTED" ? { rejectionReason } : {}),
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      },
    })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
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
