import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    const { id: goalId } = await params

    const goal = await prisma.goal.findFirst({ where: { id: goalId, companyId: user.companyId } })
    if (!goal) throw new ApiError(404, "Meta não encontrada")

    const { searchParams } = new URL(request.url)
    const days = Math.min(Number(searchParams.get("days") ?? 90), 400)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const records = await prisma.goalRecord.findMany({
      where: { goalId, date: { gte: since } },
      include: { reportedBy: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    })

    return Response.json(records)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Reporta o resultado diário de uma meta — obrigatório para SECTOR/EMPLOYEE
 * (metas COMPANY+DAILY normalmente já chegam via o fechamento de caixa, ver
 * app/api/company/shift-closing, mas esta rota também serve para correção manual).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id: goalId } = await params
    const companyId = user.companyId

    const goal = await prisma.goal.findFirst({ where: { id: goalId, companyId } })
    if (!goal) throw new ApiError(404, "Meta não encontrada")

    const formData = await request.formData()
    const dateRaw = formData.get("date")
    const amount = formData.get("amount")
    const file = formData.get("file")

    if (!amount) throw new ApiError(400, "Informe o resultado do dia")
    const date = startOfDay(dateRaw && typeof dateRaw === "string" ? new Date(dateRaw) : new Date())
    const receiptUrl = file instanceof File && file.size > 0 ? await uploadImage("closings", file) : undefined

    const record = await prisma.goalRecord.upsert({
      where: { goalId_date: { goalId, date } },
      update: { amount: Number(amount), ...(receiptUrl ? { receiptUrl } : {}), reportedById: user.id },
      create: { goalId, date, amount: Number(amount), receiptUrl, reportedById: user.id },
      include: { reportedBy: { select: { id: true, name: true } } },
    })

    await logAudit({ userId: user.id, companyId, action: "UPSERT", entity: "GoalRecord", entityId: record.id, details: { goalId, date, amount } })

    return Response.json(record, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
