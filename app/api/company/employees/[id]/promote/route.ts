import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { promoteEmployee } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"
import { notifyUser } from "@/lib/notifications"

/** Muda o cargo do colaborador no Programa Interno — zera a pontuação (regra de mudança de cargo). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const employee = await prisma.user.findFirst({ where: { id, companyId, role: "EMPLOYEE" } })
    if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")

    const body = await request.json()
    const { levelId } = body as { levelId: string }
    if (!levelId) throw new ApiError(400, "Selecione o novo nível/cargo")

    const level = await prisma.internalLevelRule.findFirst({ where: { id: levelId, internalProgram: { companyId } } })
    if (!level) throw new ApiError(404, "Nível não encontrado nesta empresa")

    const updated = await promoteEmployee(id, levelId)

    await logAudit({
      userId: user.id,
      companyId,
      action: "UPDATE",
      entity: "EmployeeProfile",
      entityId: updated.id,
      details: { promotedTo: level.name, levelId, xpReset: true },
    })

    await notifyUser({
      userId: employee.id,
      type: "GENERIC",
      title: "Você foi promovido!",
      message: `Seu cargo no Programa Interno foi atualizado para ${level.name}.`,
      linkUrl: "/company/crescimento",
      email: employee.email,
      phone: employee.phone,
    })

    return Response.json({ id: employee.id, currentInternalLevelId: levelId, xpPoints: 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
