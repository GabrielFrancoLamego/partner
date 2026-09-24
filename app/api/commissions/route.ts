import { prisma } from "@/lib/prisma"
import { requireUser, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"
import { touchPartnerActivity } from "@/lib/program-lifecycle"
import { computeReferralCommissionValue } from "@/lib/commission-format"

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Registro no Scanner PDV — dois modos:
 *  - Resgate de Promotion específica (promotionId presente): comissão =
 *    Promotion.cost, como já era.
 *  - Indicação "pura" ao Programa de Parceria (sem promotionId): comissão
 *    calculada automaticamente a partir do Program (ou do nível do parceiro,
 *    quando aplicável) sobre o Valor Total da Conta informado.
 * Em ambos os casos o Valor Total da Conta do cliente é obrigatório (mesmo
 * em comissão fixa, só para fins de faturamento gerado) — pode ser 0,00
 * desde que acompanhado de justificativa.
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
    const amountRaw = formData.get("amount")
    const billJustification = formData.get("billJustification")
    const file = formData.get("file")

    if (typeof partnerId !== "string" || !partnerId) throw new ApiError(400, "Parceiro é obrigatório")
    if (typeof clientName !== "string" || !clientName.trim()) throw new ApiError(400, "Nome do cliente é obrigatório")
    if (typeof customerPhone !== "string" || !customerPhone.trim())
      throw new ApiError(400, "Telefone do cliente é obrigatório")
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Foto da comanda é obrigatória")
    if (file.size > 8 * 1024 * 1024) throw new ApiError(400, "Arquivo excede 8MB")
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"].includes(file.type)) {
      throw new ApiError(400, "Formato não suportado — envie uma imagem (JPG/PNG/WEBP) ou PDF")
    }

    if (amountRaw === null || amountRaw === "") throw new ApiError(400, "Informe o Valor Total da Conta do cliente")
    const amount = Number(amountRaw)
    if (Number.isNaN(amount) || amount < 0) throw new ApiError(400, "Valor da conta inválido")
    const justification = typeof billJustification === "string" ? billJustification.trim() : ""
    if (amount === 0 && !justification) {
      throw new ApiError(400, "Conta com valor R$ 0,00 exige justificativa (ex: cliente desistiu antes de consumir)")
    }

    const partner = await prisma.user.findFirst({ where: { id: partnerId, role: "PARTNER", status: "ACTIVE" } })
    if (!partner) throw new ApiError(404, "Parceiro não encontrado")

    const hasPromotion = typeof promotionId === "string" && promotionId.length > 0

    let commissionValue: number
    let finalPromotionId: string | null = null
    let programId: string | null = null

    if (hasPromotion) {
      const promotion = await prisma.promotion.findFirst({ where: { id: promotionId, companyId: user.companyId } })
      if (!promotion) throw new ApiError(404, "Promoção não encontrada")
      if (!promotion.active) throw new ApiError(400, "Promoção inativa")
      const now = new Date()
      if (promotion.validFrom > now || promotion.validUntil < now) throw new ApiError(400, "Promoção fora do período de validade")
      if (promotion.stock !== null && promotion.usedCount >= promotion.stock) throw new ApiError(400, "Promoção sem estoque disponível")

      // Cooldown de reuso só faz sentido para resgate de Promotion (evita
      // abuso do mesmo benefício) — indicação pura ao programa não tem essa regra.
      const recentUse = await prisma.commission.findFirst({
        where: {
          companyId: user.companyId,
          customerPhone,
          promotionId: { not: null },
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

      commissionValue = Number(promotion.cost)
      finalPromotionId = promotion.id
    } else {
      const program = await prisma.program.findUnique({ where: { companyId: user.companyId } })
      if (!program || program.status === "ARCHIVED") throw new ApiError(400, "Esta empresa não tem um Programa de Parceria ativo")

      commissionValue = computeReferralCommissionValue(
        {
          commissionType: program.commissionType,
          commissionFormat: program.commissionFormat,
          commissionValue: Number(program.commissionValue),
          fixedValue: program.fixedValue ? Number(program.fixedValue) : null,
        },
        amount,
      )
      programId = program.id
    }

    let billAttachmentUrl: string
    try {
      billAttachmentUrl = await uploadImage("receipts", file)
    } catch {
      throw new ApiError(502, "Falha ao enviar a foto da comanda. Verifique sua conexão e tente novamente.")
    }

    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { primaryUnitId: true },
    })

    const now = new Date()
    const [commission] = await prisma.$transaction([
      prisma.commission.create({
        data: {
          companyId: user.companyId,
          partnerId,
          unitId: employeeProfile?.primaryUnitId ?? null,
          promotionId: finalPromotionId,
          programId,
          scannedById: user.id,
          clientName: clientName.trim(),
          customerPhone: customerPhone.trim(),
          qrCodeId: crypto.randomUUID(),
          amount,
          billJustification: amount === 0 ? justification : null,
          commissionValue,
          status: "PENDING",
          acceptedAt: now,
          billAttachmentUrl,
        },
        include: {
          partner: { select: { name: true } },
          promotion: { select: { title: true } },
        },
      }),
      ...(finalPromotionId ? [prisma.promotion.update({ where: { id: finalPromotionId }, data: { usedCount: { increment: 1 } } })] : []),
    ])

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "CREATE",
      entity: "Commission",
      entityId: commission.id,
      details: { promotionId: finalPromotionId, programId, partnerId, clientName, amount, fileName: file.name, fileSize: file.size },
    })

    // Geração de QR/comissão é o sinal de atividade do parceiro nesta empresa
    // — reseta a contagem dos 90 dias de inatividade (ver lib/program-lifecycle.ts).
    await touchPartnerActivity(partnerId, user.companyId)

    return Response.json(commission, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
