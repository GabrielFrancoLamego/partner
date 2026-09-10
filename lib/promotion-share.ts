import "server-only"
import QRCode from "qrcode"
import { Resend } from "resend"

export async function generatePromotionQrDataUrl(promotionId: string) {
  return QRCode.toDataURL(`tribuss:promotion:${promotionId}`, { width: 480, margin: 2 })
}

export function buildWhatsAppShareUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Envia o e-mail formatado com o benefício ao cliente indicado. Sem
 * RESEND_API_KEY configurada (ambiente local/sem provedor contratado ainda),
 * não falha a operação — devolve `sent: false` e o HTML pronto, para o
 * parceiro copiar/enviar manualmente, mesmo padrão já usado em todo o app
 * para links de convite/redefinição de senha sem envio automático.
 */
export async function sendPromotionEmail(params: {
  to: string
  partnerName: string
  companyName: string
  promotionTitle: string
  benefitDescription: string
  bannerUrl: string | null
  qrDataUrl: string
}) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden;">
      ${params.bannerUrl ? `<img src="${params.bannerUrl}" alt="${params.promotionTitle}" style="width:100%; display:block;" />` : ""}
      <div style="padding: 24px;">
        <p style="color:#999; font-size:12px; margin:0 0 4px;">Indicação de ${params.partnerName} · ${params.companyName}</p>
        <h1 style="font-size:20px; color:#3E2415; margin:0 0 12px;">${params.promotionTitle}</h1>
        <p style="color:#555; font-size:14px; line-height:1.5;">${params.benefitDescription}</p>
        <p style="color:#999; font-size:12px; margin-top:16px;">Apresente o QR Code abaixo no caixa:</p>
        <img src="${params.qrDataUrl}" alt="QR Code" style="width:220px; height:220px; margin: 8px auto; display:block;" />
      </div>
    </div>
  `.trim()

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false, html }
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || "Tribuss <onboarding@resend.dev>",
      to: params.to,
      subject: `Você ganhou um benefício: ${params.promotionTitle}`,
      html,
    })
    return { sent: true, html }
  } catch {
    return { sent: false, html }
  }
}
