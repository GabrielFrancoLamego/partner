import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageFinance } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageFinance)
    const { id } = await params

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) throw new ApiError(400, "Arquivo é obrigatório")

    const withdrawal = await prisma.withdrawal.findFirst({ where: { id, companyId: user.companyId } })
    if (!withdrawal) throw new ApiError(404, "Saque não encontrado")

    const url = await uploadImage("receipts", file)

    const updated = await prisma.withdrawal.update({ where: { id }, data: { proofOfPaymentUrl: url } })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "PIX_APPROVAL",
      entity: "Withdrawal",
      entityId: id,
      details: { attachedProof: true, fileName: file.name },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
