import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canOperateFrontDesk } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

/** `scope=team` (Gerente/Master) traz todas as solicitações da empresa; padrão é o próprio usuário. */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const isTeamScope = searchParams.get("scope") === "team"
    if (isTeamScope) requireCapability(user, canManageDailyOperations)

    const justifications = await prisma.timeEntryJustification.findMany({
      where: { companyId, ...(isTeamScope ? {} : { employeeId: user.id }) },
      include: { employee: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return Response.json(justifications)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canOperateFrontDesk)
    const companyId = user.companyId

    const formData = await request.formData()
    const dateRaw = formData.get("date")
    const reason = formData.get("reason")
    const file = formData.get("file")

    if (typeof dateRaw !== "string" || !dateRaw) throw new ApiError(400, "Data é obrigatória")
    if (typeof reason !== "string" || !reason.trim()) throw new ApiError(400, "Motivo é obrigatório")

    const documentUrl = file instanceof File && file.size > 0 ? await uploadImage("justifications", file) : null

    const justification = await prisma.timeEntryJustification.create({
      data: { companyId, employeeId: user.id, date: new Date(dateRaw), reason: reason.trim(), documentUrl },
      include: { employee: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "TimeEntryJustification", entityId: justification.id })

    return Response.json(justification, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
