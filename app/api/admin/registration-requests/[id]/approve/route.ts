import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"
import { payAffiliateSignupBonus } from "@/lib/affiliate"

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

    // Cadastros vindos de um link tokenizado (admin) herdam o papel do link;
    // cadastros vindos direto de /join/company/[slug] ou /join/partner usam
    // `role` gravado no próprio request (ver app/api/public/**).
    const role = registrationRequest.link?.role ?? registrationRequest.role

    const user = await createPlatformUser({
      email: registrationRequest.email,
      name: registrationRequest.name,
      role,
      companyId: registrationRequest.companyId,
      phone: registrationRequest.phone,
      document: registrationRequest.document ?? undefined,
      fullName: registrationRequest.name,
    })

    if (role === "PARTNER" && registrationRequest.affiliateId) {
      const partnerProfile = await prisma.partnerProfile.update({
        where: { userId: user.id },
        data: { affiliateId: registrationRequest.affiliateId },
      })
      await payAffiliateSignupBonus(registrationRequest.affiliateId, partnerProfile.id)
    }

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
      details: { createdUserId: user.id, role },
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
