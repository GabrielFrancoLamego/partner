import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"
import { payAffiliateSignupBonus } from "@/lib/affiliate"
import { provisionCompanyWithMaster } from "@/lib/company-provisioning"
import { notifyUser } from "@/lib/notifications"

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

    // Empresa nova: nunca cria um User solto — provisiona Company + License +
    // Master. Vem de um link COMPANY_SIGNUP tokenizado do Admin OU do link
    // especial (sem token) de um Afiliado — ver app/api/public/company-signup.
    const isCompanySignup = registrationRequest.link?.type === "COMPANY_SIGNUP" || registrationRequest.role === "COMPANY_MASTER"
    if (isCompanySignup) {
      if (!registrationRequest.desiredCompanySlug || !registrationRequest.masterName) {
        throw new ApiError(400, "Cadastro de empresa incompleto")
      }

      const { company, master } = await provisionCompanyWithMaster({
        name: registrationRequest.name,
        slug: registrationRequest.desiredCompanySlug,
        masterName: registrationRequest.masterName,
        masterEmail: registrationRequest.email,
        masterWhatsapp: registrationRequest.phone,
        plan: registrationRequest.link?.plan,
        isExempt: registrationRequest.link?.isExempt,
        exemptionMonths: registrationRequest.link?.exemptionMonths,
        affiliateId: registrationRequest.affiliateId,
      })

      const updated = await prisma.publicRegistrationRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date(), createdUserId: master.id },
      })

      await logAudit({
        userId: admin.id,
        companyId: company.id,
        action: "APPROVE_REGISTRATION",
        entity: "PublicRegistrationRequest",
        entityId: id,
        details: { createdCompanyId: company.id, createdUserId: master.id },
      })

      await notifyUser({
        userId: master.id,
        type: "REGISTRATION_APPROVED",
        title: "Cadastro aprovado!",
        message: `Sua empresa "${company.name}" foi aprovada. Você já pode acessar a plataforma.`,
        email: master.email,
        phone: registrationRequest.phone,
      })

      return Response.json(updated)
    }

    // Cadastros vindos de um link tokenizado (admin) herdam o papel do link;
    // cadastros vindos direto de /join/company/[slug] ou /join/partner usam
    // `role` gravado no próprio request (ver app/api/public/**).
    const role = registrationRequest.link?.role ?? registrationRequest.role

    const user = await createPlatformUser({
      email: registrationRequest.email,
      name: registrationRequest.name,
      role,
      // User.companyId é null para PARTNER por convenção (parceiro não
      // pertence a uma única empresa — ver model User). Um cadastro
      // PARTNER_FOR_COMPANY carrega companyId só como metadado de origem;
      // a vinculação real acontece via Referral/Commission por indicação.
      companyId: role === "PARTNER" ? null : registrationRequest.companyId,
      phone: registrationRequest.phone,
      document: registrationRequest.document ?? undefined,
      fullName: registrationRequest.name,
    })

    if (role === "EMPLOYEE" && registrationRequest.sectorId) {
      await prisma.employeeProfile.update({
        where: { userId: user.id },
        data: { sectorId: registrationRequest.sectorId },
      })
    }

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

    await notifyUser({
      userId: user.id,
      type: "REGISTRATION_APPROVED",
      title: "Cadastro aprovado!",
      message: "Seu cadastro foi aprovado. Você já pode acessar a plataforma.",
      email: user.email,
      phone: registrationRequest.phone,
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
