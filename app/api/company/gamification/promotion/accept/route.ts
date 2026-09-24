import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { promoteEmployee } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"
import { notifyCompanyManagement } from "@/lib/notifications"

/** Colaborador aceita a promoção oferecida pelo Master/Gerente — aplica o novo cargo e o aumento salarial estipulado. */
export async function POST() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      include: { pendingPromotionLevel: true },
    })
    if (!profile?.pendingPromotionLevelId || !profile.pendingPromotionLevel) {
      throw new ApiError(400, "Você não tem nenhuma promoção pendente de aceite")
    }

    const level = profile.pendingPromotionLevel
    const salaryIncreasePercent = level.salaryIncreasePercent ? Number(level.salaryIncreasePercent) : 0
    const appliesPercent = level.benefitType !== "FIXED" && salaryIncreasePercent > 0

    const updated = await prisma.$transaction(async (tx) => {
      const result = await promoteEmployee(user.id, level.id, tx)
      if (appliesPercent && profile.monthlySalary) {
        const newSalary = Number(profile.monthlySalary) * (1 + salaryIncreasePercent / 100)
        await tx.employeeProfile.update({ where: { userId: user.id }, data: { monthlySalary: newSalary } })
      }
      return result
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: "UPDATE",
      entity: "EmployeeProfile",
      entityId: updated.id,
      details: { promotionAccepted: level.name, levelId: level.id, salaryIncreasePercent: appliesPercent ? salaryIncreasePercent : null },
    })

    await notifyCompanyManagement(companyId, {
      type: "GENERIC",
      title: "Promoção aceita",
      message: `${user.name} aceitou a promoção para ${level.name}.`,
      linkUrl: "/company/crescimento",
    })

    return Response.json({ ok: true, currentInternalLevelId: level.id })
  } catch (error) {
    return handleApiError(error)
  }
}
