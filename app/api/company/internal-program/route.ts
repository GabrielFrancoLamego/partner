import type { MeasurementPeriod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

const MEASUREMENT_PERIODS: MeasurementPeriod[] = ["MONTHLY", "SEMIANNUAL", "ANNUAL"]

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
    const pointsOnTimeCheckIn = formData.get("pointsOnTimeCheckIn")
    const pointsChecklistOnTime = formData.get("pointsChecklistOnTime")
    const pointsChecklistLateOrRejected = formData.get("pointsChecklistLateOrRejected")
    const pointsOccurrencePenalty = formData.get("pointsOccurrencePenalty")
    const minEfficiencyPercent = formData.get("minEfficiencyPercent")
    const efficiencyBonusAmount = formData.get("efficiencyBonusAmount")
    const imageFile = formData.get("image")
    const pdfFile = formData.get("pdf")

    if (!title || typeof title !== "string") throw new ApiError(400, "Título é obrigatório")
    if (measurementPeriod && !MEASUREMENT_PERIODS.includes(measurementPeriod as MeasurementPeriod)) {
      throw new ApiError(400, "Período de medição inválido")
    }

    const imageUrl = imageFile instanceof File && imageFile.size > 0 ? await uploadImage("programs", imageFile) : undefined
    const pdfUrl = pdfFile instanceof File && pdfFile.size > 0 ? await uploadImage("programs", pdfFile) : undefined

    const data = {
      title,
      description: typeof description === "string" ? description : undefined,
      termsContent: typeof termsContent === "string" ? termsContent : undefined,
      measurementPeriod: (measurementPeriod as MeasurementPeriod) || undefined,
      ...(pointsOnTimeCheckIn ? { pointsOnTimeCheckIn: Number(pointsOnTimeCheckIn) } : {}),
      ...(pointsChecklistOnTime ? { pointsChecklistOnTime: Number(pointsChecklistOnTime) } : {}),
      ...(pointsChecklistLateOrRejected ? { pointsChecklistLateOrRejected: Number(pointsChecklistLateOrRejected) } : {}),
      ...(pointsOccurrencePenalty ? { pointsOccurrencePenalty: Number(pointsOccurrencePenalty) } : {}),
      ...(minEfficiencyPercent ? { minEfficiencyPercent: Number(minEfficiencyPercent) } : {}),
      ...(efficiencyBonusAmount ? { efficiencyBonusAmount: Number(efficiencyBonusAmount) } : {}),
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
