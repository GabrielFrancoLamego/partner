import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageCompanyUsers } from "@/lib/permissions"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"
import { payAffiliateSignupBonus } from "@/lib/affiliate"
import { notifyUser } from "@/lib/notifications"

/** Aprovação de cadastro pendente pelo Master — só requests já vinculados à própria empresa (EMPLOYEE ou PARTNER_FOR_COMPANY). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageCompanyUsers)
    const { id } = await params

    const registrationRequest = await prisma.publicRegistrationRequest.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!registrationRequest) throw new ApiError(404, "Cadastro não encontrado")
    if (registrationRequest.status !== "PENDING_APPROVAL") throw new ApiError(400, "Este cadastro já foi avaliado")

    const newUser = await createPlatformUser({
      email: registrationRequest.email,
      name: registrationRequest.name,
      role: registrationRequest.role,
      companyId: registrationRequest.role === "PARTNER" ? null : registrationRequest.companyId,
      phone: registrationRequest.phone,
      document: registrationRequest.document ?? undefined,
      fullName: registrationRequest.name,
    })

    if (registrationRequest.role === "EMPLOYEE" && registrationRequest.sectorId) {
      await prisma.employeeProfile.update({ where: { userId: newUser.id }, data: { sectorId: registrationRequest.sectorId } })
    }

    if (registrationRequest.role === "PARTNER" && registrationRequest.affiliateId) {
      const partnerProfile = await prisma.partnerProfile.update({
        where: { userId: newUser.id },
        data: { affiliateId: registrationRequest.affiliateId },
      })
      await payAffiliateSignupBonus(registrationRequest.affiliateId, partnerProfile.id)
    }

    const updated = await prisma.publicRegistrationRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date(), createdUserId: newUser.id },
    })

    await logAudit({
      userId: user.id,
      companyId: user.companyId,
      action: "APPROVE_REGISTRATION",
      entity: "PublicRegistrationRequest",
      entityId: id,
      details: { createdUserId: newUser.id, role: registrationRequest.role },
    })

    await notifyUser({
      userId: newUser.id,
      type: "REGISTRATION_APPROVED",
      title: "Cadastro aprovado!",
      message: "Seu cadastro foi aprovado. Você já pode acessar a plataforma.",
      email: newUser.email,
      phone: registrationRequest.phone,
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
