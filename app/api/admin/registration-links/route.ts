import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { isPlanId } from "@/lib/plans"

export async function GET() {
  try {
    await requirePlatformAdmin()

    const links = await prisma.publicRegistrationLink.findMany({
      include: {
        company: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(links)
  } catch (error) {
    return handleApiError(error)
  }
}

const CreateLinkSchema = z
  .object({
    type: z.enum(["COMPANY_SIGNUP", "EMPLOYEE_SIGNUP", "PARTNER_GENERIC", "PARTNER_FOR_COMPANY"]),
    companyId: z.string().trim().optional(),
    role: z.enum(["EMPLOYEE", "COMPANY_GERENTE"]).optional(),
    sectorId: z.string().trim().optional(),
    plan: z.string().trim().optional(),
    isExempt: z.boolean().optional().default(false),
    exemptionMonths: z.number().int().min(1).max(60).nullable().optional(),
    origin: z.string().trim().max(200).optional(),
    expiresInDays: z.number().int().positive().nullable().optional(), // null/undefined = indeterminado
  })
  .superRefine((data, ctx) => {
    if ((data.type === "EMPLOYEE_SIGNUP" || data.type === "PARTNER_FOR_COMPANY") && !data.companyId) {
      ctx.addIssue({ code: "custom", message: "Empresa é obrigatória para este tipo de link", path: ["companyId"] })
    }
    if (data.type === "COMPANY_SIGNUP" && data.plan && !isPlanId(data.plan)) {
      ctx.addIssue({ code: "custom", message: "Plano inválido", path: ["plan"] })
    }
  })

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const parsed = CreateLinkSchema.safeParse(await request.json())
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")
    const data = parsed.data

    const expiresAt = data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000) : null

    const link = await prisma.publicRegistrationLink.create({
      data: {
        type: data.type,
        companyId: data.type === "EMPLOYEE_SIGNUP" || data.type === "PARTNER_FOR_COMPANY" ? data.companyId : null,
        role: data.type === "EMPLOYEE_SIGNUP" ? (data.role ?? "EMPLOYEE") : "EMPLOYEE",
        sectorId: data.type === "EMPLOYEE_SIGNUP" ? (data.sectorId ?? null) : null,
        plan: data.type === "COMPANY_SIGNUP" ? (data.plan ?? null) : null,
        isExempt: data.type === "COMPANY_SIGNUP" ? data.isExempt : false,
        exemptionMonths: data.type === "COMPANY_SIGNUP" && data.isExempt ? (data.exemptionMonths ?? null) : null,
        origin: data.origin || null,
        expiresAt,
        createdById: admin.id,
      },
    })

    return Response.json(link, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
