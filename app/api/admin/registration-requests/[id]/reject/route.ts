import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { notifyEmailOnly } from "@/lib/notifications"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { reason } = body as { reason?: string }

    const registrationRequest = await prisma.publicRegistrationRequest.findUnique({ where: { id } })
    if (!registrationRequest) throw new ApiError(404, "Cadastro não encontrado")
    if (registrationRequest.status !== "PENDING_APPROVAL") {
      throw new ApiError(400, "Este cadastro já foi avaliado")
    }

    const updated = await prisma.publicRegistrationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: registrationRequest.companyId,
      action: "REJECT_REGISTRATION",
      entity: "PublicRegistrationRequest",
      entityId: id,
      details: { reason },
    })

    await notifyEmailOnly(
      registrationRequest.email,
      "Cadastro não aprovado",
      reason
        ? `Seu cadastro na Tribuss não foi aprovado. Motivo: ${reason}`
        : "Seu cadastro na Tribuss não foi aprovado. Entre em contato para mais informações.",
    )

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
