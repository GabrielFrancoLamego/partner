import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, isCompanyMasterOrAdmin } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * A Gerente só pode editar/excluir uma ocorrência até o fechamento do
 * expediente do dia dela ser concluído — depois disso, só o Master (que
 * também é quem pode reabrir/corrigir um fechamento já COMPLETED). Evita a
 * Gerente alterar o histórico financeiro de um dia que já foi encerrado.
 */
async function assertEditableByRole(companyId: string, occurrenceDate: Date, role: string) {
  if (isCompanyMasterOrAdmin(role as Parameters<typeof isCompanyMasterOrAdmin>[0])) return
  const closing = await prisma.shiftClosing.findUnique({
    where: { companyId_date: { companyId, date: startOfDay(occurrenceDate) } },
    select: { status: true },
  })
  if (closing?.status === "COMPLETED") {
    throw new ApiError(403, "O expediente deste dia já foi fechado — só o Master pode editar ou excluir esta ocorrência agora.")
  }
}

/** Editar uma ocorrência — Gerente/Master/Admin, mas a Gerente só até o fechamento do dia. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.occurrence.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Ocorrência não encontrada")
    await assertEditableByRole(companyId, existing.date, user.role)

    const body = await request.json()
    const { value, quantity, paymentMethod, paymentStatus, description, discountWaived } = body

    // Quitar exige forma de pagamento + comprovante (POST /api/company/finance/settle) — não dá
    // para marcar como Paga editando a ocorrência.
    if (paymentStatus === "PAID" && existing.paymentStatus !== "PAID") {
      throw new ApiError(400, "Para marcar como paga use 'Marcar como Pago' e anexe o comprovante de pagamento")
    }

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
 * Excluir uma ocorrência — Gerente/Master/Admin, mas a Gerente só até o
 * fechamento do expediente do dia (ver assertEditableByRole acima). Quando a
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
    await assertEditableByRole(user.companyId, existing.date, user.role)

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
