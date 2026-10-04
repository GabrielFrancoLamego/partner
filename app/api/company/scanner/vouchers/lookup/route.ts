import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"

/**
 * Consulta o benefício de um Vale Retorno pelo código, SEM dar baixa — usado
 * pelo Scanner para mostrar o benefício ao colaborador antes de confirmar em
 * "Usar Voucher" (ver POST .../scanner/redeem, que de fato consome o QR).
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    if (!code) throw new ApiError(400, "Código inválido")

    const voucher = await prisma.promotionVoucher.findFirst({
      where: { code, companyId },
      include: { promotion: { select: { title: true, description: true, bannerUrl: true, offerType: true, creditAmount: true, active: true } } },
    })
    if (!voucher) throw new ApiError(404, "Vale Retorno não encontrado")
    if (voucher.status === "REDEEMED") throw new ApiError(409, "Este Vale Retorno já foi utilizado")
    if (voucher.status === "CANCELED") throw new ApiError(409, "Este Vale Retorno foi cancelado")
    if (voucher.expiresAt && voucher.expiresAt < new Date()) throw new ApiError(409, "Este Vale Retorno expirou")
    if (!voucher.promotion.active) throw new ApiError(400, "Promoção inativa")

    return Response.json({ clientName: voucher.clientName, promotion: voucher.promotion })
  } catch (error) {
    return handleApiError(error)
  }
}
