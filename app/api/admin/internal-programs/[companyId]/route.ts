import type { MeasurementPeriod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

const MEASUREMENT_PERIODS: MeasurementPeriod[] = ["MONTHLY", "BIMONTHLY", "SEMIANNUAL", "ANNUAL"]

/** Visão cross-tenant do Programa Interno — o Admin vê/edita o de qualquer empresa. */
export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    await requirePlatformAdmin()
    const { companyId } = await params

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, city: true } })
    if (!company) throw new ApiError(404, "Empresa não encontrada")

    const program = await prisma.internalProgram.findUnique({
      where: { companyId },
      include: { levels: { orderBy: { order: "asc" } } },
    })

    return Response.json({ company, program })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { companyId } = await params

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new ApiError(404, "Empresa não encontrada")

    const formData = await request.formData()
    const title = formData.get("title")
    const description = formData.get("description")
    const termsContent = formData.get("termsContent")
    const measurementPeriod = formData.get("measurementPeriod")
    const basePoints = formData.get("basePoints")
    const pointsPunctualEntry = formData.get("pointsPunctualEntry")
    const pointsChecklistOnTime = formData.get("pointsChecklistOnTime")
    const pointsChecklistLate = formData.get("pointsChecklistLate")
    const pointsChecklistFail = formData.get("pointsChecklistFail")
    const pointsAbsenceJustified = formData.get("pointsAbsenceJustified")
    const pointsAbsenceUnjustified = formData.get("pointsAbsenceUnjustified")
    const pointsOccurrence = formData.get("pointsOccurrence")
    const minEfficiencyPercent = formData.get("minEfficiencyPercent")
    const efficiencyBonusAmount = formData.get("efficiencyBonusAmount")
    const videoUrl = formData.get("videoUrl")
    const imageUrl = formData.get("imageUrl")
    const pdfUrl = formData.get("pdfUrl")

    if (!title || typeof title !== "string") throw new ApiError(400, "Título é obrigatório")
    if (measurementPeriod && !MEASUREMENT_PERIODS.includes(measurementPeriod as MeasurementPeriod)) {
      throw new ApiError(400, "Período de medição inválido")
    }

    const data = {
      title,
      description: typeof description === "string" ? description : undefined,
      termsContent: typeof termsContent === "string" ? termsContent : undefined,
      measurementPeriod: (measurementPeriod as MeasurementPeriod) || undefined,
      ...(basePoints ? { basePoints: Number(basePoints) } : {}),
      ...(pointsPunctualEntry ? { pointsPunctualEntry: Number(pointsPunctualEntry) } : {}),
      ...(pointsChecklistOnTime ? { pointsChecklistOnTime: Number(pointsChecklistOnTime) } : {}),
      ...(pointsChecklistLate ? { pointsChecklistLate: Number(pointsChecklistLate) } : {}),
      ...(pointsChecklistFail ? { pointsChecklistFail: Number(pointsChecklistFail) } : {}),
      ...(pointsAbsenceJustified ? { pointsAbsenceJustified: Number(pointsAbsenceJustified) } : {}),
      ...(pointsAbsenceUnjustified ? { pointsAbsenceUnjustified: Number(pointsAbsenceUnjustified) } : {}),
      ...(pointsOccurrence ? { pointsOccurrence: Number(pointsOccurrence) } : {}),
      ...(minEfficiencyPercent ? { minEfficiencyPercent: Number(minEfficiencyPercent) } : {}),
      ...(efficiencyBonusAmount ? { efficiencyBonusAmount: Number(efficiencyBonusAmount) } : {}),
      ...(typeof videoUrl === "string" ? { videoUrl: videoUrl || null } : {}),
      ...(typeof imageUrl === "string" && imageUrl ? { imageUrl } : {}),
      ...(typeof pdfUrl === "string" && pdfUrl ? { pdfUrl } : {}),
    }

    const program = await prisma.internalProgram.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data, title },
      include: { levels: { orderBy: { order: "asc" } } },
    })

    await logAudit({ userId: admin.id, companyId, action: "UPSERT", entity: "InternalProgram", entityId: program.id })

    return Response.json({ company, program })
  } catch (error) {
    return handleApiError(error)
  }
}
