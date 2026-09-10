import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { isPlanId } from "@/lib/plans"
import { isValidEmail, isValidPhone } from "@/lib/validators"
import { revertExpiredExemptions } from "@/lib/license-exemption"
import { provisionCompanyWithMaster } from "@/lib/company-provisioning"

export async function GET() {
  try {
    await requirePlatformAdmin()
    await revertExpiredExemptions()

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
  exemptionMonths: z.number().int().min(1).max(60).nullable().optional(),
  billingDay: z.number().int().min(1).max(28).nullable().optional(),
})

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()

    const parsed = CreateCompanySchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const { company, master, inviteLink } = await provisionCompanyWithMaster(parsed.data)

    await logAudit({
      userId: admin.id,
      companyId: company.id,
      action: "CREATE",
      entity: "Company",
      entityId: company.id,
      details: { ...parsed.data, masterEmail: parsed.data.masterEmail },
    })

    return Response.json({ company, master: { id: master.id, email: master.email }, inviteLink }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
