import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { toUserId, reason } = body

    if (!toUserId) throw new ApiError(400, "Novo responsável é obrigatório")

    const checklist = await prisma.checklist.findUnique({ where: { id } })
    if (!checklist) throw new ApiError(404, "Checklist não encontrado")
    if (checklist.employeeId === toUserId) throw new ApiError(400, "O checklist já está com este colaborador")
    if (!checklist.employeeId) {
      throw new ApiError(400, "Esta tarefa compartilhada ainda não tem responsável — não há de quem reatribuir (use a reserva normal, não reatribuição)")
    }

    const [reassignment, updated] = await prisma.$transaction([
      prisma.checklistReassignment.create({
        data: {
          checklistId: id,
          fromUserId: checklist.employeeId,
          toUserId,
          reassignedById: admin.id,
          reason,
        },
      }),
      prisma.checklist.update({ where: { id }, data: { employeeId: toUserId } }),
    ])

    await logAudit({
      userId: admin.id,
      companyId: checklist.companyId,
      action: "REASSIGN",
      entity: "Checklist",
      entityId: id,
      details: { fromUserId: checklist.employeeId, toUserId, reason },
    })

    return Response.json({ reassignment, checklist: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
