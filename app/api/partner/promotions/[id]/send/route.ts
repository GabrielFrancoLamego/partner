import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { generatePromotionQrDataUrl, buildWhatsAppShareUrl, sendPromotionEmail } from "@/lib/promotion-share"

function describeBenefit(promotion: {
  offerType: string
  discountPercentage: unknown
  discountedPrice: unknown
  originalPrice: unknown
  creditAmount: unknown
}) {
  if (promotion.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (promotion.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (promotion.offerType === "CASH_CREDIT") return promotion.creditAmount ? `R$ ${promotion.creditAmount} de crédito na comanda` : "Crédito na comanda"
  if (promotion.discountPercentage) return `${promotion.discountPercentage}% de desconto`
  if (promotion.originalPrice && promotion.discountedPrice) return `De R$ ${promotion.originalPrice} por R$ ${promotion.discountedPrice}`
  return "Desconto especial"
}

/** Parceiro dispara o card de apresentação (QR + e-mail) para o cliente indicado. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    const { id } = await params

    const promotion = await prisma.promotion.findFirst({
      where: { id, active: true },
      include: { company: { select: { id: true, name: true, address: true, neighborhood: true, city: true, state: true } } },
    })
    if (!promotion) throw new ApiError(404, "Promoção não encontrada")

    // Só quem já aderiu ao Programa de Parceria da empresa pode ofertar a
    // promoção dela ao cliente indicado (ver /partner/descobrir).
    const membership = await prisma.programMembership.findFirst({
      where: { partnerId: user.id, companyId: promotion.company.id, status: "ACTIVE" },
    })
    if (!membership) throw new ApiError(403, "Você precisa aderir ao Programa de Parceria desta empresa antes de ofertar esta promoção")

    const body = await request.json()
    const { clientName, clientEmail, clientPhone } = body as { clientName?: string; clientEmail?: string; clientPhone?: string }
    if (!clientEmail && !clientPhone) throw new ApiError(400, "Informe email ou WhatsApp do cliente")

    const qrDataUrl = await generatePromotionQrDataUrl(promotion.id)
    const benefitDescription = describeBenefit(promotion)
    const companyAddress = [promotion.company.address, promotion.company.neighborhood, promotion.company.city, promotion.company.state]
      .filter(Boolean)
      .join(", ")

    let emailResult: { sent: boolean; html: string } | null = null
    if (clientEmail) {
      emailResult = await sendPromotionEmail({
        to: clientEmail,
        clientName,
        partnerName: user.name,
        companyName: promotion.company.name,
        companyAddress: companyAddress || null,
        promotionTitle: promotion.title,
        benefitDescription,
        bannerUrl: promotion.bannerUrl,
        qrDataUrl,
        validUntil: promotion.validUntil,
      })
    }

    const greetingName = clientName ? `${clientName}, ` : ""
    const whatsappUrl = clientPhone
      ? buildWhatsAppShareUrl(
          clientPhone,
          `${greetingName}${user.name} indicou você para "${promotion.title}" na ${promotion.company.name}! 🎁 Benefício: ${benefitDescription}.${companyAddress ? ` Endereço: ${companyAddress}.` : ""} Apresente o QR Code (em anexo/print) ou este link no caixa: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/beneficio/${promotion.id}`,
        )
      : null

    return Response.json({ qrDataUrl, emailSent: emailResult?.sent ?? false, emailHtml: emailResult?.html ?? null, whatsappUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
