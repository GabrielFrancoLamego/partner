/**
 * Utilitários puros (servidor e navegador) do voucher do cliente indicado:
 * rota até o estabelecimento (Google Maps/Waze com as coordenadas exatas),
 * contato (ligar/WhatsApp) e o texto da mensagem enviada ao cliente.
 */
export type VoucherCompany = {
  name: string
  address?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  latitude?: number | null
  longitude?: number | null
}

export function fullAddress(company: VoucherCompany) {
  return [company.address, company.neighborhood, company.city, company.state].filter(Boolean).join(", ")
}

/** Google Maps: traça a rota até o ponto exato (lat,lng); sem coordenadas, usa o endereço escrito. */
export function googleMapsRouteUrl(company: VoucherCompany) {
  const destination = company.latitude != null && company.longitude != null ? `${company.latitude},${company.longitude}` : [company.name, fullAddress(company)].filter(Boolean).join(", ")
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
}

export function wazeRouteUrl(company: VoucherCompany) {
  if (company.latitude != null && company.longitude != null) return `https://waze.com/ul?ll=${company.latitude},${company.longitude}&navigate=yes`
  return `https://waze.com/ul?q=${encodeURIComponent(fullAddress(company) || company.name)}&navigate=yes`
}

export function phoneDigits(phone: string | null | undefined) {
  return (phone ?? "").replace(/\D/g, "")
}

export function telUrl(phone: string | null | undefined) {
  const digits = phoneDigits(phone)
  return digits ? `tel:+${digits.startsWith("55") ? digits : `55${digits}`}` : null
}

/** wa.me exige DDI — números brasileiros sem 55 ganham o prefixo. */
export function whatsappUrl(phone: string | null | undefined, text?: string) {
  const digits = phoneDigits(phone)
  if (!digits) return null
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`
  return `https://wa.me/${withCountry}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

export function describePromotionBenefit(promotion: {
  offerType: string
  discountPercentage?: unknown
  discountedPrice?: unknown
  originalPrice?: unknown
  creditAmount?: unknown
}) {
  if (promotion.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (promotion.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (promotion.offerType === "CASH_CREDIT") return promotion.creditAmount ? `R$ ${promotion.creditAmount} de crédito na comanda` : "Crédito na comanda"
  if (promotion.discountPercentage) return `${promotion.discountPercentage}% de desconto`
  if (promotion.originalPrice && promotion.discountedPrice) return `De R$ ${promotion.originalPrice} por R$ ${promotion.discountedPrice}`
  return "Desconto especial"
}

/** Mensagem pronta (WhatsApp/compartilhar) com benefício, endereço, rota, telefone e o link do voucher. */
export function buildVoucherMessage(p: {
  clientName?: string | null
  partnerName: string
  promotionTitle: string
  benefit: string
  company: VoucherCompany
  voucherUrl: string
}) {
  const address = fullAddress(p.company)
  const lines = [
    `${p.clientName ? `Olá, ${p.clientName}! ` : "Olá! "}🎁 ${p.partnerName} indicou você para "${p.promotionTitle}" no ${p.company.name}.`,
    `✨ Benefício: ${p.benefit}`,
    address ? `📍 ${p.company.name} — ${address}` : null,
    `🗺️ Como chegar: ${googleMapsRouteUrl(p.company)}`,
    p.company.phone ? `📞 Reservas/dúvidas: ${p.company.phone}` : null,
    `🎟️ Seu voucher com o QR Code: ${p.voucherUrl}`,
  ]
  return lines.filter(Boolean).join("\n")
}
