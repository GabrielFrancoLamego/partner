import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { createPlatformUser, generatePasswordResetLink } from "@/lib/admin-user"
import { isPlanId } from "@/lib/plans"
import { getPlanCatalog } from "@/lib/plan-catalog"
import { isValidEmail, isValidPhone } from "@/lib/validators"

export async function GET() {
  try {
    await requirePlatformAdmin()

    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: {
        license: true,
        _count: { select: { users: true, units: true, programs: true, promotions: true } },
      },
    })

    return Response.json(companies)
  } catch (error) {
    return handleApiError(error)
  }
}

const CreateCompanySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  masterName: z.string().trim().min(1, "Nome do Master é obrigatório"),
  masterEmail: z.string().trim().refine(isValidEmail, "Email do Master inválido"),
  masterWhatsapp: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidPhone(v), "WhatsApp do Master inválido"),
  plan: z
    .string()
    .optional()
    .refine((v) => !v || isPlanId(v), "Plano inválido")
    .default("ENTERPRISE"),
  isExempt: z.boolean().optional().default(false),
  billingDay: z.number().int().min(1).max(28).nullable().optional(),
})

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()

    const parsed = CreateCompanySchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")
    }
    const { name, slug, masterName, masterEmail, masterWhatsapp, isExempt, billingDay } = parsed.data
    const plan = isPlanId(parsed.data.plan) ? parsed.data.plan : "ENTERPRISE"
    const catalog = await getPlanCatalog()
    const planDef = catalog[plan]

    const company = await prisma.company.create({
      data: {
        name,
        slug,
        license: {
          create: {
            plan,
            maxEmployees: planDef.maxEmployees,
            maxPartners: planDef.maxPartners,
            isExempt,
            billingDay: billingDay ?? null,
          },
        },
      },
      include: { license: true },
    })

    try {
      const master = await createPlatformUser({
        email: masterEmail,
        name: masterName,
        role: "COMPANY_MASTER",
        companyId: company.id,
        phone: masterWhatsapp,
      })

      const inviteLink = await generatePasswordResetLink(masterEmail)

      await logAudit({
        userId: admin.id,
        companyId: company.id,
        action: "CREATE",
        entity: "Company",
        entityId: company.id,
        details: { name, slug, plan, isExempt, billingDay, masterEmail },
      })

      return Response.json({ company, master: { id: master.id, email: master.email }, inviteLink }, { status: 201 })
    } catch (masterError) {
      // Compensação: não deixar uma empresa "órfã" sem Master se o provisionamento falhar.
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {})
      throw masterError
    }
  } catch (error) {
    return handleApiError(error)
  }
}
