import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"
import { isValidEmail, isValidPhone } from "@/lib/validators"

export async function GET() {
  try {
    await requirePlatformAdmin()

    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { partners: true, joinRequests: true, payouts: true } } },
    })

    return Response.json(affiliates)
  } catch (error) {
    return handleApiError(error)
  }
}

const CreateAffiliateSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidEmail(v), "Email inválido"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidPhone(v), "Telefone inválido"),
  bonusPerPartner: z.number().min(0).default(0),
  milestoneClientCount: z.number().int().min(1).default(10),
  milestoneBonus: z.number().min(0).default(0),
  pixKey: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const parsed = CreateAffiliateSchema.safeParse(await request.json())
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")

    const db = auditedClient({ userId: admin.id, role: admin.role })
    const affiliate = await db.affiliate.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        bonusPerPartner: parsed.data.bonusPerPartner,
        milestoneClientCount: parsed.data.milestoneClientCount,
        milestoneBonus: parsed.data.milestoneBonus,
        pixKey: parsed.data.pixKey || null,
      },
    })

    return Response.json(affiliate, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
