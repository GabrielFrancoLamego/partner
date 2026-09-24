import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { monthsSince } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

/** Master/Gerente aplica a promoção disponível — fica pendente até o Colaborador aceitar (ver .../promotion/accept). */
export async function POST(_request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId
    const { employeeId } = await params

    const profile = await prisma.employeeProfile.findFirst({
      where: { userId: employeeId, user: { companyId, role: "EMPLOYEE" } },
      include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } },
    })
    if (!profile) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
    if (profile.pendingPromotionLevelId) throw new ApiError(400, "Este colaborador já tem uma promoção pendente de aceite")

    const program = await prisma.internalProgram.findUnique({ where: { companyId }, include: { levels: { orderBy: { order: "asc" } } } })
    const levels = program?.levels ?? []
    const currentLevel = profile.currentInternalLevelId ? levels.find((l) => l.id === profile.currentInternalLevelId) : levels[0]
    if (!currentLevel) throw new ApiError(400, "Colaborador ainda não está em nenhum cargo da régua")
    const nextLevel = levels.find((l) => l.order === currentLevel.order + 1)
    if (!nextLevel) throw new ApiError(400, "Não há um próximo cargo configurado na régua")

    const tenureStart = profile.currentInternalLevelSince ?? profile.user.createdAt
    const monthsInRole = monthsSince(tenureStart)
    if (profile.xpPoints < nextLevel.pointsRequired) throw new ApiError(400, "Colaborador ainda não atingiu a pontuação necessária")
    if (currentLevel.minTenureMonths > 0 && monthsInRole < currentLevel.minTenureMonths) {
      throw new ApiError(400, `Colaborador ainda não cumpriu o tempo mínimo no cargo (${currentLevel.minTenureMonths} meses)`)
    }

    await prisma.employeeProfile.update({
      where: { userId: employeeId },
      data: { pendingPromotionLevelId: nextLevel.id, pendingPromotionOfferedAt: new Date() },
    })

    await notifyUser({
      userId: employeeId,
      type: "PROMOTION_OFFERED",
      title: "Você tem uma promoção disponível!",
      message: `Você está apto(a) a assumir o cargo de ${nextLevel.name}. Acesse Programa & Crescimento para aceitar.`,
      linkUrl: "/company/crescimento",
      email: profile.user.email,
      phone: profile.user.phone,
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: "UPDATE",
      entity: "EmployeeProfile",
      entityId: profile.id,
      details: { promotionOfferedTo: nextLevel.name, levelId: nextLevel.id },
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
