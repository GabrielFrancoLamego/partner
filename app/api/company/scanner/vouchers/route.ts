import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"
import { generateQrDataUrl, buildWhatsAppShareUrl } from "@/lib/promotion-share"
import { Resend } from "resend"

/** Histórico de Vale Retorno emitidos pela empresa. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const { searchParams } = new URL(request.url)
    const promotionId = searchParams.get("promotionId")

    const vouchers = await prisma.promotionVoucher.findMany({
      where: { companyId: user.companyId, ...(promotionId ? { promotionId } : {}) },
      include: {
        promotion: { select: { id: true, title: true } },
        issuedBy: { select: { id: true, name: true } },
        redeemedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return Response.json(vouchers)
  } catch (error) {
    return handleApiError(error)
  }
}

async function trySendVoucherEmail(to: string, promotionTitle: string, companyName: string, qrDataUrl: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || "Tribuss <onboarding@resend.dev>",
      to,
      subject: `Seu Vale Retorno: ${promotionTitle}`,
      html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; text-align:center;">
        <h1 style="font-size:18px; color:#3E2415;">Vale Retorno — ${companyName}</h1>
        <p style="color:#555; font-size:14px;">Apresente este QR Code na sua próxima visita para resgatar: <strong>${promotionTitle}</strong></p>
        <img src="${qrDataUrl}" alt="QR Code" style="width:240px;height:240px;" />
      </div>`,
    })
    return true
  } catch {
    return false
  }
}

/**
 * "Vale Retorno" — Colaborador emite um QR Code de uma Promotion (tipicamente
 * audience=INTERNAL) para o cliente voltar em outra data, enviado via
 * WhatsApp/E-mail. O código vai dentro do QR e é lido pelo Scanner (ver
 * POST /api/company/scanner/redeem) para dar baixa.
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const body = await request.json()
    const { promotionId, clientName, clientPhone, clientEmail } = body as {
      promotionId?: string
      clientName?: string
      clientPhone?: string
      clientEmail?: string
    }

    if (!promotionId) throw new ApiError(400, "Selecione a promoção do Vale Retorno")
    if (!clientPhone && !clientEmail) throw new ApiError(400, "Informe o WhatsApp ou e-mail do cliente")

    const promotion = await prisma.promotion.findFirst({
      where: { id: promotionId, companyId, active: true },
      include: { company: { select: { name: true } } },
    })
    if (!promotion) throw new ApiError(404, "Promoção não encontrada")

    // Vale Retorno vale para "voltar em outra data" — validade de 30 dias,
    // independente de Promotion.qrCodeValidityMinutes (que é para o resgate
    // imediato de um QR normal, em minutos).
    const VOUCHER_VALIDITY_DAYS = 30
    const expiresAt = new Date(Date.now() + VOUCHER_VALIDITY_DAYS * 24 * 60 * 60 * 1000)

    const voucher = await prisma.promotionVoucher.create({
      data: {
        companyId,
        promotionId,
        issuedById: user.id,
        clientName: clientName?.trim() || null,
        clientPhone: clientPhone?.trim() || null,
        clientEmail: clientEmail?.trim() || null,
        channel: clientEmail ? "email" : "whatsapp",
        expiresAt,
      },
    })

    const qrDataUrl = await generateQrDataUrl(`tribuss:voucher:${voucher.code}`)

    let emailSent = false
    if (clientEmail) {
      emailSent = await trySendVoucherEmail(clientEmail, promotion.title, promotion.company.name, qrDataUrl)
    }
    const whatsappUrl = clientPhone
      ? buildWhatsAppShareUrl(
          clientPhone,
          `${promotion.company.name} — Aqui está seu Vale Retorno para "${promotion.title}"! Apresente este código no balcão na sua próxima visita: ${voucher.code}`,
        )
      : null

    return Response.json({ voucher, qrDataUrl, emailSent, whatsappUrl }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
