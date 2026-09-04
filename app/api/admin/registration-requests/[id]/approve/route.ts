import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const registrationRequest = await prisma.publicRegistrationRequest.findUnique({
      where: { id },
      include: { link: true },
    })

    if (!registrationRequest) throw new ApiError(404, "Cadastro não encontrado")
    if (registrationRequest.status !== "PENDING_APPROVAL") {
      throw new ApiError(400, "Este cadastro já foi avaliado")
    }

    const user = await createPlatformUser({
      email: registrationRequest.email,
      name: registrationRequest.name,
      role: registrationRequest.link.role,
      companyId: registrationRequest.companyId,
    })

    const updated = await prisma.publicRegistrationRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        createdUserId: user.id,
      },
    })

    await logAudit({
      userId: admin.id,
      companyId: registrationRequest.companyId,
      action: "APPROVE_REGISTRATION",
      entity: "PublicRegistrationRequest",
      entityId: id,
      details: { createdUserId: user.id },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
