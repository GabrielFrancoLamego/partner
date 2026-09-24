import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Histórico unificado de resgates do Scanner — combina Commission (resgate
 * direto/QR de promoção com indicação de Parceiro) e PromotionVoucher já
 * REDEEMED (Vale Retorno), normalizados numa lista só, ordenada por data.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const fromRaw = searchParams.get("from")
    const toRaw = searchParams.get("to")
    const from = startOfDay(fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const to = new Date(startOfDay(toRaw ? new Date(toRaw) : new Date()).getTime() + 24 * 60 * 60 * 1000)

    const [commissions, vouchers] = await Promise.all([
      prisma.commission.findMany({
        where: { companyId, promotionId: { not: null }, date: { gte: from, lt: to } },
        include: { promotion: { select: { title: true } }, partner: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 200,
      }),
      prisma.promotionVoucher.findMany({
        where: { companyId, status: "REDEEMED", redeemedAt: { gte: from, lt: to } },
        include: { promotion: { select: { title: true } }, redeemedBy: { select: { name: true } } },
        orderBy: { redeemedAt: "desc" },
        take: 200,
      }),
    ])

    const fromCommissions = commissions.map((c) => ({
      id: `commission:${c.id}`,
      kind: "PROMOTION" as const,
      promotionTitle: c.promotion?.title ?? "—",
      clientName: c.clientName,
      referredBy: c.partner.name,
      amount: c.amount,
      attachmentUrl: c.billAttachmentUrl,
      date: c.date,
    }))
    const fromVouchers = vouchers.map((v) => ({
      id: `voucher:${v.id}`,
      kind: "VALE_RETORNO" as const,
      promotionTitle: v.promotion.title,
      clientName: v.clientName ?? "—",
      referredBy: v.redeemedBy?.name ?? "—",
      amount: v.redeemedAmount,
      attachmentUrl: v.redeemedAttachmentUrl,
      date: v.redeemedAt,
    }))

    const merged = [...fromCommissions, ...fromVouchers].sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    )

    return Response.json(merged)
  } catch (error) {
    return handleApiError(error)
  }
}
