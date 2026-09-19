import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { awardXp, getInternalProgramRules } from "@/lib/gamification"
import { logAudit } from "@/lib/audit"

/**
 * Double-check da Gerente/Master sobre uma tarefa SUBMITTED pelo colaborador:
 * - APPROVED: confirma e credita XP (integral se dentro do prazo, 0 se fora).
 * - RETURNED: devolve para o colaborador refazer (volta a PENDING), com
 *   observação — não pontua nem penaliza ainda, será reavaliada na próxima entrega.
 * - REJECTED: "não entregue" definitivo — penaliza XP, exige justificativa.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const checklist = await prisma.checklist.findFirst({ where: { id, companyId } })
    if (!checklist) throw new ApiError(404, "Checklist não encontrado")

    const body = await request.json()
    const { status, note } = body as { status: "APPROVED" | "RETURNED" | "REJECTED"; note?: string }
    if (!["APPROVED", "RETURNED", "REJECTED"].includes(status)) throw new ApiError(400, "Status inválido")

    if (status === "RETURNED" || status === "REJECTED") {
      if (checklist.status !== "SUBMITTED" && checklist.status !== "PENDING") {
        throw new ApiError(400, "Checklist já foi finalizado")
      }
      if (!note?.trim()) throw new ApiError(400, "Descreva o motivo")
    } else if (checklist.status !== "SUBMITTED") {
      throw new ApiError(400, "Só é possível aprovar uma tarefa já entregue pelo colaborador")
    }

    const now = new Date()
    const onTime = !checklist.dueAt || now <= checklist.dueAt
    const rules = await getInternalProgramRules(companyId)

    const updated = await prisma.$transaction(async (tx) => {
      if (status === "RETURNED") {
        return tx.checklist.update({
          where: { id },
          data: { status: "PENDING", rejectionReason: note!.trim(), approvedById: null, approvedAt: null, submittedAt: null },
          include: { employee: { select: { id: true, name: true } } },
        })
      }

      const saved = await tx.checklist.update({
        where: { id },
        data: {
          status,
          approvedById: user.id,
          approvedAt: now,
          ...(status === "REJECTED" ? { rejectionReason: note!.trim() } : {}),
        },
        include: { employee: { select: { id: true, name: true } } },
      })

      // Só quem tem EmployeeProfile participa do sistema de XP — quando a
      // reassumpção automática cai no Master/Gerente (sem EmployeeProfile),
      // a tarefa é aprovada/reprovada normalmente, só sem pontuar ninguém.
      const points = status === "APPROVED" ? (onTime ? rules.pointsChecklistOnTime : rules.pointsChecklistLate) : rules.pointsChecklistFail
      if (points !== 0) {
        const hasEmployeeProfile = await tx.employeeProfile.findUnique({ where: { userId: checklist.employeeId } })
        if (hasEmployeeProfile) {
          await awardXp(
            {
              companyId,
              employeeId: checklist.employeeId,
              reason: "CHECKLIST_ON_TIME",
              points,
              sourceId: id,
              note: status === "APPROVED" ? (onTime ? "No prazo" : "Fora do prazo") : "Não entregue",
            },
            tx,
          )
        }
      }

      return saved
    })

    await logAudit({ userId: user.id, companyId, action: status, entity: "Checklist", entityId: id, details: { onTime, note } })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
