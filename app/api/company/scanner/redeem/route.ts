import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

/**
 * Dá baixa em um Vale Retorno lido pela câmera do Scanner (payload
 * "tribuss:voucher:<code>") — valida a promoção, exige o valor da conta e
 * cria a Commission correspondente, marcando o voucher como REDEEMED
 * (QR utilizado, não pode ser lido de novo).
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const formData = await request.formData()
    const qrPayload = formData.get("qrPayload")
    const clientName = formData.get("clientName")
    const amountRaw = formData.get("amount")
    const billJustification = formData.get("billJustification")
    const file = formData.get("file")

    if (typeof qrPayload !== "string" || !qrPayload) throw new ApiError(400, "QR Code inválido")
    const match = qrPayload.match(/^tribuss:voucher:(.+)$/)
    if (!match) throw new ApiError(400, "Este QR Code não é um Vale Retorno válido")
    const code = match[1]

    if (amountRaw === null || amountRaw === "") throw new ApiError(400, "Informe o Valor Total da Conta do cliente")
    const amount = Number(amountRaw)
    if (Number.isNaN(amount) || amount < 0) throw new ApiError(400, "Valor da conta inválido")
    const justification = typeof billJustification === "string" ? billJustification.trim() : ""
    if (amount === 0 && !justification) throw new ApiError(400, "Conta com valor R$ 0,00 exige justificativa")

    const voucher = await prisma.promotionVoucher.findFirst({
      where: { code, companyId },
      include: { promotion: true },
    })
    if (!voucher) throw new ApiError(404, "Vale Retorno não encontrado")
    if (voucher.status === "REDEEMED") throw new ApiError(409, "Este Vale Retorno já foi utilizado")
    if (voucher.status === "CANCELED") throw new ApiError(409, "Este Vale Retorno foi cancelado")
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      await prisma.promotionVoucher.update({ where: { id: voucher.id }, data: { status: "EXPIRED" } })
      throw new ApiError(409, "Este Vale Retorno expirou")
    }
    if (!voucher.promotion.active) throw new ApiError(400, "Promoção inativa")

    let attachmentUrl: string | null = null
    if (file instanceof File && file.size > 0) {
      try {
        attachmentUrl = await uploadImage("receipts", file)
      } catch {
        throw new ApiError(502, "Falha ao enviar a foto da comanda. Tente novamente.")
      }
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.promotionVoucher.update({
        where: { id: voucher.id },
        data: {
          status: "REDEEMED",
          redeemedAt: now,
          redeemedById: user.id,
          redeemedAmount: amount,
          redeemedBillJustification: amount === 0 ? justification : null,
          redeemedAttachmentUrl: attachmentUrl,
          ...(typeof clientName === "string" && clientName.trim() ? { clientName: clientName.trim() } : {}),
        },
      }),
      prisma.promotion.update({ where: { id: voucher.promotionId }, data: { usedCount: { increment: 1 } } }),
    ])

    await logAudit({
      userId: user.id,
      companyId,
      action: "REDEEM",
      entity: "PromotionVoucher",
      entityId: voucher.id,
      details: { promotionId: voucher.promotionId, amount },
    })

    return Response.json({ ok: true, promotionTitle: voucher.promotion.title })
  } catch (error) {
    return handleApiError(error)
  }
}
