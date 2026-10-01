import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

/** Editar uma ocorrência — exclusivo de Gerente/Master/Admin. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.occurrence.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Ocorrência não encontrada")

    const body = await request.json()
    const { value, quantity, paymentMethod, paymentStatus, description, discountWaived } = body

    const nextValue = value !== undefined ? (value === null ? null : Number(value)) : existing.value
    const nextQuantity = quantity !== undefined ? Number(quantity) : Number(existing.quantity)
    const total = nextValue !== null ? Math.round(Number(nextValue) * nextQuantity * 100) / 100 : null

    const updated = await prisma.occurrence.update({
      where: { id },
      data: {
        ...(value !== undefined ? { value: nextValue } : {}),
        ...(quantity !== undefined ? { quantity: nextQuantity } : {}),
        total,
        ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod || null } : {}),
        ...(paymentStatus !== undefined ? { paymentStatus } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(discountWaived !== undefined ? { discountWaived } : {}),
      },
      include: { employee: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "Occurrence", entityId: id, details: body })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Excluir uma ocorrência — exclusivo de Gerente/Master/Admin. Quando a
 * ocorrência é uma "Premiação de Meta" (type=META) gerada pela distribuição
 * automática de prêmio (ver lib/goal-rewards.ts), excluir aqui também
 * estorna o GoalPayout irmão — a dívida/crédito na carteira digital do
 * colaborador some junto, não fica órfã.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.occurrence.findFirst({
      where: { id, companyId: user.companyId },
      include: { goalPayout: true },
    })
    if (!existing) throw new ApiError(404, "Ocorrência não encontrada")

    await prisma.$transaction(async (tx) => {
      if (existing.goalPayout) await tx.goalPayout.delete({ where: { id: existing.goalPayout.id } })
      await tx.occurrence.delete({ where: { id } })
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "Occurrence", entityId: id })
    if (existing.goalPayout) {
      await logAudit({
        userId: user.id,
        companyId: user.companyId,
        action: "DELETE",
        entity: "GoalPayout",
        entityId: existing.goalPayout.id,
        details: { reason: "Estornado junto com a Occurrence de Premiação de Meta" },
      })
      if (existing.employeeId) {
        await notifyUser({
          userId: existing.employeeId,
          type: "GENERIC",
          title: "Premiação de meta estornada",
          message: `A premiação da meta "${existing.description ?? "equipe"}" foi cancelada pelo Master e o valor foi estornado da sua carteira.`,
          linkUrl: "/company/metas",
        }).catch(() => {})
      }
    }

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
