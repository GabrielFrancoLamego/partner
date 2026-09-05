import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { awardXp, getInternalProgramRules } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

/** Gerente/Master aprova (concede XP se dentro do prazo) ou reprova (pequena penalidade) a execução. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const checklist = await prisma.checklist.findFirst({ where: { id, companyId } })
    if (!checklist) throw new ApiError(404, "Checklist não encontrado")
    if (checklist.status !== "PENDING") throw new ApiError(400, "Checklist já foi revisado")

    const body = await request.json()
    const { status } = body as { status: "APPROVED" | "REJECTED" }
    if (status !== "APPROVED" && status !== "REJECTED") throw new ApiError(400, "Status inválido")

    const now = new Date()
    const onTime = !checklist.dueAt || now <= checklist.dueAt
    const rules = await getInternalProgramRules(companyId)

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.checklist.update({
        where: { id },
        data: { status, approvedById: user.id, approvedAt: now },
        include: { employee: { select: { id: true, name: true } } },
      })

      const points = status === "APPROVED" ? (onTime ? rules.pointsChecklistOnTime : 0) : rules.pointsChecklistLateOrRejected
      if (points !== 0) {
        await awardXp(
          { companyId, employeeId: checklist.employeeId, reason: "CHECKLIST_ON_TIME", points, sourceId: id, note: status === "APPROVED" ? (onTime ? "No prazo" : "Fora do prazo") : "Reprovado" },
          tx,
        )
      }

      return saved
    })

    await logAudit({ userId: user.id, companyId, action: status, entity: "Checklist", entityId: id, details: { onTime } })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
