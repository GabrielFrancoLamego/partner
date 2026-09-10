import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"
import { isValidEmail, isValidPhone } from "@/lib/validators"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const {
      name,
      email,
      phone,
      rewardType,
      bonusPerPartner,
      bonusPercentage,
      milestoneClientCount,
      milestoneBonus,
      pixKey,
      active,
    } = body

    if (email !== undefined && email && !isValidEmail(email)) throw new ApiError(400, "Email inválido")
    if (phone !== undefined && phone && !isValidPhone(phone)) throw new ApiError(400, "Telefone inválido")

    const db = auditedClient({ userId: admin.id, role: admin.role })
    const affiliate = await db.affiliate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(rewardType !== undefined ? { rewardType } : {}),
        ...(bonusPerPartner !== undefined ? { bonusPerPartner } : {}),
        ...(bonusPercentage !== undefined ? { bonusPercentage: bonusPercentage ?? null } : {}),
        ...(milestoneClientCount !== undefined ? { milestoneClientCount } : {}),
        ...(milestoneBonus !== undefined ? { milestoneBonus } : {}),
        ...(pixKey !== undefined ? { pixKey: pixKey || null } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    return Response.json(affiliate)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const db = auditedClient({ userId: admin.id, role: admin.role })
    await db.affiliate.delete({ where: { id } })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
