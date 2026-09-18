import "server-only"
import { prisma } from "./prisma"
import { createPlatformUser, generatePasswordResetLink } from "./admin-user"
import { isPlanId, type PlanId } from "./plans"
import { getPlanCatalog } from "./plan-catalog"
import { computeExemptionExpiresAt } from "./license-exemption"

/**
 * Cria Company + License + usuário Master, com rollback da empresa se o
 * provisionamento do Master falhar (email duplicado etc). Usado tanto pelo
 * cadastro direto do Admin (POST /api/admin/companies) quanto pela aprovação
 * de um PublicRegistrationRequest vindo de um link COMPANY_SIGNUP.
 */
export async function provisionCompanyWithMaster(input: {
  name: string
  slug: string
  masterName: string
  masterEmail: string
  masterWhatsapp?: string | null
  plan?: string | null
  isExempt?: boolean
  exemptionMonths?: number | null
  billingDay?: number | null
  /** Empresa cadastrada pelo link especial de um Afiliado (/join/company?ref=CODE) — ver /partner/afiliado. */
  affiliateId?: string | null
}) {
  const plan: PlanId = isPlanId(input.plan) ? input.plan : "ENTERPRISE"
  const catalog = await getPlanCatalog()
  const planDef = catalog[plan]
  const isExempt = input.isExempt ?? false
  const exemptionMonths = isExempt ? (input.exemptionMonths ?? null) : null

  const company = await prisma.company.create({
    data: {
      name: input.name,
      slug: input.slug,
      affiliateId: input.affiliateId ?? null,
      license: {
        create: {
          plan,
          maxEmployees: planDef.maxEmployees,
          maxPartners: planDef.maxPartners,
          isExempt,
          exemptionMonths,
          exemptionExpiresAt: exemptionMonths ? computeExemptionExpiresAt(exemptionMonths) : null,
          billingDay: input.billingDay ?? null,
        },
      },
    },
    include: { license: true },
  })

  try {
    const master = await createPlatformUser({
      email: input.masterEmail,
      name: input.masterName,
      role: "COMPANY_MASTER",
      companyId: company.id,
      phone: input.masterWhatsapp ?? undefined,
    })

    const inviteLink = await generatePasswordResetLink(input.masterEmail)

    return { company, master, inviteLink }
  } catch (masterError) {
    await prisma.company.delete({ where: { id: company.id } }).catch(() => {})
    throw masterError
  }
}
