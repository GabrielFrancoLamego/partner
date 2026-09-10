import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { isPlanId } from "@/lib/plans"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    if (!isPlanId(id)) throw new ApiError(404, "Plano não encontrado")

    const body = await request.json()
    const { label, maxEmployees, maxPartners, oneTimePrice, monthlyPrice } = body

    const before = await prisma.plan.findUnique({ where: { id } })

    const plan = await prisma.plan.upsert({
      where: { id },
      update: {
        ...(label !== undefined ? { label } : {}),
        ...(maxEmployees !== undefined ? { maxEmployees } : {}),
        ...(maxPartners !== undefined ? { maxPartners } : {}),
        ...(oneTimePrice !== undefined ? { oneTimePrice } : {}),
        ...(monthlyPrice !== undefined ? { monthlyPrice } : {}),
      },
      create: {
        id,
        label: label ?? id,
        maxEmployees: maxEmployees ?? 0,
        maxPartners: maxPartners ?? 0,
        oneTimePrice: oneTimePrice ?? 0,
        monthlyPrice: monthlyPrice ?? 0,
      },
    })

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "Plan",
      entityId: id,
      details: { before, after: plan },
    })

    return Response.json(plan)
  } catch (error) {
    return handleApiError(error)
  }
}
