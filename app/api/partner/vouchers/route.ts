import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { generateQrDataUrl, sendVoucherEmail } from "@/lib/promotion-share"
import {
  buildVoucherMessage,
  describePromotionBenefit,
  fullAddress,
  googleMapsRouteUrl,
  telUrl,
  whatsappUrl,
  type VoucherCompany,
} from "@/lib/voucher-links"
import { isValidEmail, isValidPhone } from "@/lib/validators"
import { logAudit } from "@/lib/audit"

function appOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin
}

const companySelect = { id: true, name: true, address: true, neighborhood: true, city: true, state: true, phone: true, latitude: true, longitude: true } as const

/**
 * Opções do gerador de voucher: estabelecimentos onde o parceiro já aderiu ao
 * Programa de Parceria (ProgramMembership ACTIVE) com as promoções externas
 * vigentes de cada um.
 */
export async function GET() {
  try {
    const user = await requirePartner()
    const now = new Date()
    const memberships = await prisma.programMembership.findMany({ where: { partnerId: user.id, status: "ACTIVE" }, select: { companyId: true } })
    const companyIds = memberships.map((m) => m.companyId)
    if (companyIds.length === 0) return Response.json([])

    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: {
        ...companySelect,
        promotions: {
          where: { active: true, audience: "EXTERNAL", validFrom: { lte: now }, validUntil: { gte: now } },
          select: { id: true, title: true, offerType: true, discountPercentage: true, discountedPrice: true, originalPrice: true, creditAmount: true, validUntil: true, stock: true, usedCount: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    })

    return Response.json(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        address: fullAddress(c),
        promotions: c.promotions
          .filter((p) => p.stock === null || p.usedCount < p.stock)
          .map((p) => ({ id: p.id, title: p.title, benefit: describePromotionBenefit(p), validUntil: p.validUntil })),
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Gera o voucher do cliente indicado (sem fricção): exige só o NOME e pelo menos
 * UM contato (e-mail OU telefone/WhatsApp) — ou `noContact: true`, que gera o QR
 * só com o nome para o parceiro mostrar na tela. O QR carrega
 * `tribuss:voucher:<code>` (lido pelo Scanner PDV) e a página pública
 * /voucher/<code> traz endereço, rota e telefone do estabelecimento.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePartner()
    const body = await request.json()
    const companyId = typeof body.companyId === "string" ? body.companyId : ""
    const promotionId = typeof body.promotionId === "string" ? body.promotionId : ""
    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : ""
    const clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim() : ""
    const clientPhone = typeof body.clientPhone === "string" ? body.clientPhone.trim() : ""
    const noContact = body.noContact === true

    if (!companyId) throw new ApiError(400, "Selecione o estabelecimento")
    if (!promotionId) throw new ApiError(400, "Selecione a promoção")
    if (!clientName) throw new ApiError(400, "Informe o nome do cliente")
    if (!noContact && !clientEmail && !clientPhone) {
      throw new ApiError(400, "Informe o e-mail ou o telefone/WhatsApp do cliente — ou marque 'Cliente sem e-mail/WhatsApp'")
    }
    if (!noContact && clientEmail && !isValidEmail(clientEmail)) throw new ApiError(400, "E-mail do cliente inválido")
    if (!noContact && clientPhone && !isValidPhone(clientPhone)) throw new ApiError(400, "Telefone/WhatsApp do cliente inválido")

    const promotion = await prisma.promotion.findFirst({
      where: { id: promotionId, companyId, active: true, audience: "EXTERNAL" },
      include: { company: { select: companySelect } },
    })
    if (!promotion) throw new ApiError(404, "Promoção não encontrada")
    const now = new Date()
    if (promotion.validFrom > now || promotion.validUntil < now) throw new ApiError(400, "Promoção fora do período de validade")
    if (promotion.stock !== null && promotion.usedCount >= promotion.stock) throw new ApiError(400, "Promoção sem estoque disponível")

    const membership = await prisma.programMembership.findFirst({ where: { partnerId: user.id, companyId, status: "ACTIVE" } })
    if (!membership) throw new ApiError(403, "Você precisa aderir ao Programa de Parceria deste estabelecimento antes de gerar vouchers")

    const useEmail = !noContact && Boolean(clientEmail)
    const usePhone = !noContact && Boolean(clientPhone)
    const voucher = await prisma.promotionVoucher.create({
      data: {
        companyId,
        promotionId,
        issuedById: user.id,
        clientName,
        clientEmail: useEmail ? clientEmail : null,
        clientPhone: usePhone ? clientPhone : null,
        channel: useEmail ? "email" : usePhone ? "whatsapp" : "manual",
        expiresAt: promotion.validUntil,
      },
    })

    const company: VoucherCompany = promotion.company
    const voucherUrl = `${appOrigin(request)}/voucher/${voucher.code}`
    const benefit = describePromotionBenefit(promotion)
    const qrDataUrl = await generateQrDataUrl(`tribuss:voucher:${voucher.code}`)
    const message = buildVoucherMessage({ clientName, partnerName: user.name, promotionTitle: promotion.title, benefit, company, voucherUrl })

    let emailSent = false
    if (useEmail) {
      emailSent = await sendVoucherEmail({
        to: clientEmail,
        clientName,
        partnerName: user.name,
        companyName: company.name,
        companyAddress: fullAddress(company) || null,
        companyPhone: company.phone,
        promotionTitle: promotion.title,
        benefitDescription: benefit,
        qrDataUrl,
        voucherUrl,
        routeUrl: googleMapsRouteUrl(company),
        telHref: telUrl(company.phone),
      })
    }

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "PromotionVoucher", entityId: voucher.id, details: { promotionId, noContact, channel: voucher.channel } })

    return Response.json(
      {
        voucher: { id: voucher.id, code: voucher.code, clientName, expiresAt: voucher.expiresAt },
        qrDataUrl,
        voucherUrl,
        message,
        emailSent,
        whatsappUrl: usePhone ? whatsappUrl(clientPhone, message) : null,
        company: { name: company.name, address: fullAddress(company), phone: company.phone },
        promotion: { title: promotion.title, benefit, validUntil: promotion.validUntil },
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
