import "server-only"
import QRCode from "qrcode"
import { sendEmail } from "./email"

export async function generatePromotionQrDataUrl(promotionId: string) {
  return QRCode.toDataURL(`tribuss:promotion:${promotionId}`, { width: 480, margin: 2 })
}

/** QR genérico a partir de um payload de texto já pronto (ex: "tribuss:voucher:<code>") — ver PromotionVoucher. */
export async function generateQrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, { width: 480, margin: 2 })
}

export function buildWhatsAppShareUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Envia o e-mail formatado com o benefício ao cliente indicado. Sem
 * BREVO_API_KEY configurada (ambiente local/sem provedor contratado ainda),
 * não falha a operação — devolve `sent: false` e o HTML pronto, para o
 * parceiro copiar/enviar manualmente, mesmo padrão já usado em todo o app
 * para links de convite/redefinição de senha sem envio automático.
 */
export async function sendPromotionEmail(params: {
  to: string
  clientName?: string | null
  partnerName: string
  companyName: string
  companyAddress?: string | null
  promotionTitle: string
  benefitDescription: string
  bannerUrl: string | null
  qrDataUrl: string
  validUntil?: Date | null
}) {
  const greeting = params.clientName ? `Olá, ${params.clientName}!` : "Você recebeu um presente!"
  const validUntilLabel = params.validUntil
    ? new Date(params.validUntil).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden; background:#F7F5F2;">
      <div style="background: linear-gradient(90deg, #F2680C, #FB9C08, #FFC800); padding: 18px 24px; text-align:center;">
        <p style="color:#fff; font-size:13px; font-weight:600; margin:0; letter-spacing:0.5px;">🎁 VOCÊ GANHOU UM BENEFÍCIO</p>
      </div>
      ${params.bannerUrl ? `<img src="${params.bannerUrl}" alt="${params.promotionTitle}" style="width:100%; display:block;" />` : ""}
      <div style="padding: 24px; background:#fff;">
        <p style="color:#3E2415; font-size:16px; font-weight:600; margin:0 0 4px;">${greeting}</p>
        <p style="color:#999; font-size:12px; margin:0 0 16px;">Indicação de ${params.partnerName}</p>

        <h1 style="font-size:20px; color:#3E2415; margin:0 0 8px;">${params.promotionTitle}</h1>
        <p style="color:#555; font-size:14px; line-height:1.5; margin:0 0 16px;">${params.benefitDescription}</p>

        <div style="background:#FFF7ED; border:1px solid #FED7AA; border-radius:12px; padding:14px; margin-bottom:16px;">
          <p style="color:#3E2415; font-size:14px; font-weight:700; margin:0 0 4px;">📍 ${params.companyName}</p>
          ${params.companyAddress ? `<p style="color:#7C5A44; font-size:13px; margin:0;">${params.companyAddress}</p>` : ""}
          ${validUntilLabel ? `<p style="color:#B45309; font-size:12px; font-weight:600; margin:8px 0 0;">Válido até ${validUntilLabel}</p>` : ""}
        </div>

        <p style="color:#999; font-size:12px; text-align:center; margin:0 0 4px;">Apresente este QR Code no caixa:</p>
        <img src="${params.qrDataUrl}" alt="QR Code" style="width:260px; height:260px; margin: 8px auto; display:block;" />
      </div>
    </div>
  `.trim()

  const sent = await sendEmail({
    to: params.to,
    subject: `Você ganhou um benefício: ${params.promotionTitle}`,
    html,
  })
  return { sent, html }
}


/**
 * E-mail do voucher do cliente indicado: QR Code, benefício, endereço e os botões
 * "Traçar rota" (Google Maps com coordenadas exatas) e "Ligar/Reservar". Sem
 * BREVO_API_KEY não falha — devolve `sent: false`.
 */
export async function sendVoucherEmail(params: {
  to: string
  clientName?: string | null
  partnerName: string
  companyName: string
  companyAddress?: string | null
  companyPhone?: string | null
  promotionTitle: string
  benefitDescription: string
  qrDataUrl: string
  voucherUrl: string
  routeUrl: string
  telHref: string | null
}) {
  const button = (href: string, label: string, bg: string) =>
    `<a href="${href}" style="display:block;background:${bg};color:#fff;text-decoration:none;font-weight:700;text-align:center;padding:14px;border-radius:12px;margin-top:10px;font-size:15px;">${label}</a>`
  return sendEmail({
    to: params.to,
    subject: `Seu voucher: ${params.promotionTitle} — ${params.companyName}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:16px;padding:24px;text-align:center;">
      <p style="color:#3E2415;font-size:16px;font-weight:700;margin:0 0 4px;">${params.clientName ? `Olá, ${params.clientName}!` : "Você ganhou um benefício!"}</p>
      <p style="color:#999;font-size:12px;margin:0 0 16px;">Indicação de ${params.partnerName}</p>
      <h1 style="font-size:20px;color:#3E2415;margin:0 0 6px;">${params.promotionTitle}</h1>
      <p style="color:#555;font-size:14px;margin:0 0 16px;">${params.benefitDescription}</p>
      <img src="${params.qrDataUrl}" alt="QR Code" style="width:240px;height:240px;" />
      <p style="color:#3E2415;font-size:14px;font-weight:700;margin:16px 0 2px;">📍 ${params.companyName}</p>
      ${params.companyAddress ? `<p style="color:#7C5A44;font-size:13px;margin:0;">${params.companyAddress}</p>` : ""}
      ${button(params.routeUrl, "🗺️ TRAÇAR ROTA ATÉ O LOCAL", "#F2680C")}
      ${params.telHref ? button(params.telHref, "📞 LIGAR / RESERVAR", "#3E2415") : ""}
      ${button(params.voucherUrl, "🎟️ Abrir meu voucher", "#16A34A")}
    </div>`,
  })
}
