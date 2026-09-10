import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const { plan, status, maxEmployees, maxPartners, billingCycle, expiresAt, isExempt, billingDay } = body

    const existing = await prisma.license.findUnique({ where: { companyId: id } })
    const isBecomingCanceled = status === "CANCELED" && existing?.status !== "CANCELED"

    const data = {
      ...(plan !== undefined ? { plan } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(maxEmployees !== undefined ? { maxEmployees } : {}),
      ...(maxPartners !== undefined ? { maxPartners } : {}),
      ...(billingCycle !== undefined ? { billingCycle } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(isExempt !== undefined ? { isExempt } : {}),
      ...(billingDay !== undefined ? { billingDay: billingDay ?? null } : {}),
      ...(isBecomingCanceled ? { canceledAt: new Date() } : {}),
    }

    const license = await prisma.license.upsert({
      where: { companyId: id },
      update: data,
      create: { companyId: id, ...data },
    })

    await logAudit({
      userId: admin.id,
      companyId: id,
      action: "UPDATE",
      entity: "License",
      entityId: license.id,
      details: body,
    })

    return Response.json(license)
  } catch (error) {
    return handleApiError(error)
  }
}
