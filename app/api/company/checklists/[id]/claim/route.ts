import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canOperateFrontDesk } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

/**
 * "Vou Fazer" — reserva uma tarefa compartilhada (FREE/SECTOR/TAG, ainda sem
 * responsável) pro colaborador logado. Atômico via updateMany condicional
 * (employeeId ainda null) — se outro colaborador já reservou um instante
 * antes, count=0 e devolve 409, em vez de uma corrida gravar os dois.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const { id } = await params
    const companyId = user.companyId

    const checklist = await prisma.checklist.findFirst({ where: { id, companyId } })
    if (!checklist) throw new ApiError(404, "Tarefa não encontrada")
    if (checklist.employeeId !== null) throw new ApiError(409, "Esta tarefa já foi reservada por outro colaborador")

    if (checklist.targetSectorId || checklist.targetTag) {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { sectorId: true, tag: true } })
      const eligible =
        (checklist.targetSectorId && profile?.sectorId === checklist.targetSectorId) ||
        (checklist.targetTag && profile?.tag === checklist.targetTag)
      if (!eligible) throw new ApiError(403, "Você não é elegível para esta tarefa")
    }

    const { count } = await prisma.checklist.updateMany({
      where: { id, employeeId: null },
      data: { employeeId: user.id, claimedAt: new Date() },
    })
    if (count === 0) throw new ApiError(409, "Esta tarefa já foi reservada por outro colaborador")

    const updated = await prisma.checklist.findUniqueOrThrow({ where: { id } })
    await logAudit({ userId: user.id, companyId, action: "CLAIM", entity: "Checklist", entityId: id })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
