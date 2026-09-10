import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { generatePromotionQrDataUrl, buildWhatsAppShareUrl, sendPromotionEmail } from "@/lib/promotion-share"

function describeBenefit(promotion: { offerType: string; discountPercentage: unknown; discountedPrice: unknown; originalPrice: unknown }) {
  if (promotion.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (promotion.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
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
      include: { company: { select: { name: true } } },
    })
    if (!promotion) throw new ApiError(404, "Promoção não encontrada")

    const body = await request.json()
    const { clientEmail, clientPhone } = body as { clientEmail?: string; clientPhone?: string }
    if (!clientEmail && !clientPhone) throw new ApiError(400, "Informe email ou WhatsApp do cliente")

    const qrDataUrl = await generatePromotionQrDataUrl(promotion.id)
    const benefitDescription = describeBenefit(promotion)

    let emailResult: { sent: boolean; html: string } | null = null
    if (clientEmail) {
      emailResult = await sendPromotionEmail({
        to: clientEmail,
        partnerName: user.name,
        companyName: promotion.company.name,
        promotionTitle: promotion.title,
        benefitDescription,
        bannerUrl: promotion.bannerUrl,
        qrDataUrl,
      })
    }

    const whatsappUrl = clientPhone
      ? buildWhatsAppShareUrl(
          clientPhone,
          `${user.name} indicou você para ${promotion.title} na ${promotion.company.name}! Benefício: ${benefitDescription}. Apresente este link no caixa: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/beneficio/${promotion.id}`,
        )
      : null

    return Response.json({ qrDataUrl, emailSent: emailResult?.sent ?? false, emailHtml: emailResult?.html ?? null, whatsappUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
