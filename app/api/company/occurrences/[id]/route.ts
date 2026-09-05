import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

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

/** Excluir uma ocorrência — exclusivo de Gerente/Master/Admin. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params

    const existing = await prisma.occurrence.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError(404, "Ocorrência não encontrada")

    await prisma.occurrence.delete({ where: { id } })
    await logAudit({ userId: user.id, companyId: user.companyId, action: "DELETE", entity: "Occurrence", entityId: id })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
