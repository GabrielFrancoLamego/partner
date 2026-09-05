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

/** `now` está depois do horário-limite (HH:mm) da empresa para o dia de `reference`. */
function isPastDeadline(reference: Date, deadline: string, now: Date) {
  const [h, m] = deadline.split(":").map(Number)
  const cutoff = new Date(reference)
  cutoff.setHours(h, m, 0, 0)
  return now > cutoff
}

/** Status do fechamento do dia — visível a todo o staff da empresa (dashboard do Master usa isso para o alerta). */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const date = startOfDay(dateParam ? new Date(dateParam) : new Date())
    const now = new Date()

    const [closing, company] = await Promise.all([
      prisma.shiftClosing.findUnique({
        where: { companyId_date: { companyId, date } },
        include: { closedBy: { select: { id: true, name: true } } },
      }),
      prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true } }),
    ])

    const overdue = !closing || closing.status !== "COMPLETED" ? isPastDeadline(date, company.shiftClosingDeadline, now) : false

    return Response.json({
      date,
      deadline: company.shiftClosingDeadline,
      closing,
      overdue,
      canOverride: overdue && user.role === "COMPANY_MASTER",
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const formData = await request.formData()
    const dateRaw = formData.get("date")
    const revenueAmount = formData.get("revenueAmount")
    const summary = formData.get("summary")
    const file = formData.get("file")

    const date = startOfDay(dateRaw && typeof dateRaw === "string" ? new Date(dateRaw) : new Date())
    const now = new Date()

    const existing = await prisma.shiftClosing.findUnique({ where: { companyId_date: { companyId, date } } })
    if (!(file instanceof File) || file.size === 0) {
      if (!existing?.receiptUrl) throw new ApiError(400, "Foto do comprovante de fechamento do caixa é obrigatória")
    }

    const receiptUrl = file instanceof File && file.size > 0 ? await uploadImage("closings", file) : existing?.receiptUrl ?? null

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { shiftClosingDeadline: true } })
    const isMasterOverride = user.role === "COMPANY_MASTER" && isPastDeadline(date, company.shiftClosingDeadline, now)

    const closing = await prisma.shiftClosing.upsert({
      where: { companyId_date: { companyId, date } },
      update: {
        revenueAmount: revenueAmount ? Number(revenueAmount) : null,
        receiptUrl,
        summary: typeof summary === "string" ? summary.trim() || null : null,
        status: "COMPLETED",
        isMasterOverride,
        closedById: user.id,
        closedAt: now,
      },
      create: {
        companyId,
        date,
        revenueAmount: revenueAmount ? Number(revenueAmount) : null,
        receiptUrl,
        summary: typeof summary === "string" ? summary.trim() || null : null,
        status: "COMPLETED",
        isMasterOverride,
        closedById: user.id,
        closedAt: now,
      },
      include: { closedBy: { select: { id: true, name: true } } },
    })

    // Sincroniza com toda meta ativa COMPANY+DAILY: o fechamento do caixa É o
    // resultado do dia para essas metas, sem exigir lançamento duplicado.
    if (revenueAmount) {
      const dailyCompanyGoals = await prisma.goal.findMany({
        where: { companyId, scope: "COMPANY", period: "DAILY", active: true },
        select: { id: true },
      })
      for (const goal of dailyCompanyGoals) {
        await prisma.goalRecord.upsert({
          where: { goalId_date: { goalId: goal.id, date } },
          update: { amount: Number(revenueAmount), receiptUrl: receiptUrl ?? undefined, reportedById: user.id },
          create: { goalId: goal.id, date, amount: Number(revenueAmount), receiptUrl, reportedById: user.id },
        })
      }
    }

    await logAudit({
      userId: user.id,
      companyId,
      action: isMasterOverride ? "MASTER_OVERRIDE" : "CREATE",
      entity: "ShiftClosing",
      entityId: closing.id,
      details: { date, revenueAmount },
    })

    return Response.json(closing, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
