import type { OccurrenceImpactKind, OccurrenceSalaryImpactType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const IMPACT_KINDS: OccurrenceImpactKind[] = ["POINTS", "SALARY", "HOURS_BANK", "INFORMATIONAL"]
const SALARY_IMPACT_TYPES: OccurrenceSalaryImpactType[] = ["DISCOUNT", "BONUS"]

/** Catálogo de tipos de ocorrência configuráveis pela empresa (Gerente/Master) — complementa os tipos fixos. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const types = await prisma.occurrenceTypeConfig.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
    })
    return Response.json(types)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { name, kind, pointsImpact, salaryImpactType, salaryImpactValue, hoursBankImpactMinutes, isTax } = body

    if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "Nome é obrigatório")
    if (!IMPACT_KINDS.includes(kind)) throw new ApiError(400, "Natureza do impacto inválida")
    if (kind === "SALARY" && salaryImpactType && !SALARY_IMPACT_TYPES.includes(salaryImpactType)) {
      throw new ApiError(400, "Tipo de impacto salarial inválido")
    }

    const type = await prisma.occurrenceTypeConfig.create({
      data: {
        companyId,
        name: name.trim(),
        kind,
        pointsImpact: kind === "POINTS" ? Number(pointsImpact) || 0 : null,
        salaryImpactType: kind === "SALARY" ? salaryImpactType || "DISCOUNT" : null,
        salaryImpactValue: kind === "SALARY" ? Number(salaryImpactValue) || 0 : null,
        hoursBankImpactMinutes: kind === "HOURS_BANK" ? Number(hoursBankImpactMinutes) || 0 : null,
        isTax: kind === "SALARY" && salaryImpactType === "DISCOUNT" ? Boolean(isTax) : false,
        createdById: user.id,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "OccurrenceTypeConfig", entityId: type.id, details: body })

    return Response.json(type, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
