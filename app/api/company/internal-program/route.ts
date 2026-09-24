import type { MeasurementPeriod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const MEASUREMENT_PERIODS: MeasurementPeriod[] = ["MONTHLY", "BIMONTHLY", "SEMIANNUAL", "ANNUAL"]

/** Visível a todo staff da empresa (colaborador precisa ler os termos/regras). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const program = await prisma.internalProgram.findUnique({
      where: { companyId: user.companyId },
      include: { levels: { orderBy: { order: "asc" } } },
    })
    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Cria/edita o Programa Interno — no máximo 1 por empresa (upsert por companyId). */
export async function PATCH(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

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
    const lateToleranceMinutes = formData.get("lateToleranceMinutes")
    const pointsLatePenalty = formData.get("pointsLatePenalty")
    const minEfficiencyPercent = formData.get("minEfficiencyPercent")
    const efficiencyBonusAmount = formData.get("efficiencyBonusAmount")
    const videoUrl = formData.get("videoUrl")
    const imageFile = formData.get("image")
    const pdfFile = formData.get("pdf")

    if (!title || typeof title !== "string") throw new ApiError(400, "Título é obrigatório")
    if (measurementPeriod && !MEASUREMENT_PERIODS.includes(measurementPeriod as MeasurementPeriod)) {
      throw new ApiError(400, "Período de medição inválido")
    }

    const imageUrl = imageFile instanceof File && imageFile.size > 0 ? await uploadImage("internal-programs", imageFile) : undefined
    const pdfUrl = pdfFile instanceof File && pdfFile.size > 0 ? await uploadImage("internal-programs", pdfFile) : undefined

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
      ...(lateToleranceMinutes ? { lateToleranceMinutes: Number(lateToleranceMinutes) } : {}),
      ...(pointsLatePenalty ? { pointsLatePenalty: Number(pointsLatePenalty) } : {}),
      ...(minEfficiencyPercent ? { minEfficiencyPercent: Number(minEfficiencyPercent) } : {}),
      ...(efficiencyBonusAmount ? { efficiencyBonusAmount: Number(efficiencyBonusAmount) } : {}),
      ...(typeof videoUrl === "string" ? { videoUrl: videoUrl || null } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(pdfUrl ? { pdfUrl } : {}),
    }

    const program = await prisma.internalProgram.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data, title },
      include: { levels: { orderBy: { order: "asc" } } },
    })

    await logAudit({ userId: user.id, companyId, action: "UPSERT", entity: "InternalProgram", entityId: program.id })

    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}
