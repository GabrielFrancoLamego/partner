import { prisma } from "@/lib/prisma"
import { generateQrDataUrl } from "@/lib/promotion-share"
import { describePromotionBenefit } from "@/lib/voucher-links"

/**
 * Voucher do cliente indicado (sem login) — o código é o segredo (cuid). Devolve
 * o QR Code, o benefício e os dados do estabelecimento (endereço, coordenadas
 * exatas e telefone oficial) para a página /voucher/<code> traçar a rota e
 * ligar/reservar. Não expõe nenhum dado pessoal além do nome do próprio cliente.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const voucher = await prisma.promotionVoucher.findUnique({
    where: { code },
    include: {
      promotion: true,
      issuedBy: { select: { name: true, role: true } },
      company: { select: { name: true, address: true, neighborhood: true, city: true, state: true, phone: true, latitude: true, longitude: true, profilePictureUrl: true } },
    },
  })
  if (!voucher) return Response.json({ error: "Voucher não encontrado" }, { status: 404 })

  const expired = voucher.status === "EXPIRED" || (voucher.expiresAt !== null && voucher.expiresAt < new Date() && voucher.status === "PENDING")
  const status = voucher.status === "REDEEMED" ? "REDEEMED" : voucher.status === "CANCELED" ? "CANCELED" : expired ? "EXPIRED" : "VALID"

  return Response.json({
    status,
    clientName: voucher.clientName,
    partnerName: voucher.issuedBy.role === "PARTNER" ? voucher.issuedBy.name : null,
    expiresAt: voucher.expiresAt,
    qrDataUrl: status === "VALID" ? await generateQrDataUrl(`tribuss:voucher:${voucher.code}`) : null,
    promotion: {
      title: voucher.promotion.title,
      description: voucher.promotion.description,
      bannerUrl: voucher.promotion.bannerUrl,
      benefit: describePromotionBenefit(voucher.promotion),
    },
    company: voucher.company,
  })
}
