import { prisma } from "@/lib/prisma"
import { requireUser, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Registra o uso de uma promoção pelo operador do PDV: confirma a promoção +
 * o parceiro que indicou o cliente (seleção real — não há geração/leitura de
 * QR ainda, ver plano) e exige a foto da comanda como comprovante.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    requireCapability(user, canOperateFrontDesk)
    if (!user.companyId) throw new ApiError(400, "Usuário sem empresa vinculada")

    const formData = await request.formData()
    const promotionId = formData.get("promotionId")
    const partnerId = formData.get("partnerId")
    const clientName = formData.get("clientName")
    const customerPhone = formData.get("customerPhone")
    const file = formData.get("file")

    if (typeof promotionId !== "string" || !promotionId) throw new ApiError(400, "Promoção é obrigatória")
    if (typeof partnerId !== "string" || !partnerId) throw new ApiError(400, "Parceiro é obrigatório")
    if (typeof clientName !== "string" || !clientName.trim()) throw new ApiError(400, "Nome do cliente é obrigatório")
    if (typeof customerPhone !== "string" || !customerPhone.trim())
      throw new ApiError(400, "Telefone do cliente é obrigatório")
    if (!(file instanceof File)) throw new ApiError(400, "Foto da comanda é obrigatória")

    const promotion = await prisma.promotion.findFirst({
      where: { id: promotionId, companyId: user.companyId },
    })
    if (!promotion) throw new ApiError(404, "Promoção não encontrada")
    if (!promotion.active) throw new ApiError(400, "Promoção inativa")
    const now = new Date()
    if (promotion.validFrom > now || promotion.validUntil < now) throw new ApiError(400, "Promoção fora do período de validade")
    if (promotion.stock !== null && promotion.usedCount >= promotion.stock) throw new ApiError(400, "Promoção sem estoque disponível")

    const partner = await prisma.user.findFirst({ where: { id: partnerId, role: "PARTNER", status: "ACTIVE" } })
    if (!partner) throw new ApiError(404, "Parceiro não encontrado")

    const recentUse = await prisma.commission.findFirst({
      where: {
        companyId: user.companyId,
        customerPhone,
        status: { not: "REJECTED" },
        date: { gte: new Date(Date.now() - NINETY_DAYS_MS) },
      },
    })
    if (recentUse) {
      throw new ApiError(
        409,
        `Este cliente já utilizou uma promoção em ${recentUse.date.toLocaleDateString("pt-BR")}. Aguarde 90 dias desde a última utilização.`,
      )
    }

    const billAttachmentUrl = await uploadImage("receipts", file)

    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { primaryUnitId: true },
    })

    const [commission] = await prisma.$transaction([
      prisma.commission.create({
        data: {
          companyId: user.companyId,
          partnerId,
          unitId: employeeProfile?.primaryUnitId ?? null,
          promotionId,
          scannedById: user.id,
          clientName: clientName.trim(),
          customerPhone: customerPhone.trim(),
          qrCodeId: crypto.randomUUID(),
          commissionValue: promotion.cost,
          status: "PENDING",
          acceptedAt: now,
          billAttachmentUrl,
        },
        include: {
          partner: { select: { name: true } },
          promotion: { select: { title: true } },
        },
      }),
      prisma.promotion.update({ where: { id: promotionId }, data: { usedCount: { increment: 1 } } }),
    ])

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "CREATE",
      entity: "Commission",
      entityId: commission.id,
      details: { promotionId, partnerId, clientName, fileName: file.name, fileSize: file.size },
    })

    return Response.json(commission, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
