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
      include: {
        _count: { select: { partners: true, joinRequests: true, payouts: true } },
        partnerProfile: { select: { id: true, fullName: true, user: { select: { name: true, email: true } } } },
      },
    })

    return Response.json(affiliates)
  } catch (error) {
    return handleApiError(error)
  }
}

const CreateAffiliateSchema = z
  .object({
    // Afiliado "externo" (influencer sem conta de parceiro) — exige name.
    // Afiliado "promovido" (parceiro real ativo) — exige partnerProfileId,
    // e nome/contato são herdados do próprio parceiro.
    partnerProfileId: z.string().trim().optional(),
    name: z.string().trim().optional(),
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
    rewardType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
    bonusPerPartner: z.number().min(0).default(0),
    bonusPercentage: z.number().min(0).max(100).nullable().optional(),
    milestoneClientCount: z.number().int().min(1).default(10),
    milestoneBonus: z.number().min(0).default(0),
    pixKey: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.partnerProfileId && !data.name) {
      ctx.addIssue({ code: "custom", message: "Nome é obrigatório para afiliado externo", path: ["name"] })
    }
    if (data.rewardType === "PERCENTAGE" && !data.bonusPercentage) {
      ctx.addIssue({ code: "custom", message: "Informe a porcentagem de recompensa", path: ["bonusPercentage"] })
    }
  })

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const parsed = CreateAffiliateSchema.safeParse(await request.json())
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")
    const data = parsed.data

    let name = data.name
    let email = data.email
    let phone = data.phone

    if (data.partnerProfileId) {
      const partner = await prisma.partnerProfile.findUnique({
        where: { id: data.partnerProfileId },
        include: { user: true },
      })
      if (!partner) throw new ApiError(404, "Parceiro não encontrado")
      if (partner.user.status !== "ACTIVE") {
        throw new ApiError(400, "Só parceiros com conta ATIVA podem virar Afiliados")
      }
      name = name || partner.fullName || partner.user.name
      email = email || partner.user.email
      phone = phone || partner.whatsapp || partner.phone || undefined
    }

    const db = auditedClient({ userId: admin.id, role: admin.role })
    const affiliate = await db.affiliate.create({
      data: {
        name: name!,
        email: email || null,
        phone: phone || null,
        partnerProfileId: data.partnerProfileId || null,
        rewardType: data.rewardType,
        bonusPerPartner: data.rewardType === "FIXED" ? data.bonusPerPartner : 0,
        bonusPercentage: data.rewardType === "PERCENTAGE" ? data.bonusPercentage : null,
        milestoneClientCount: data.milestoneClientCount,
        milestoneBonus: data.milestoneBonus,
        pixKey: data.pixKey || null,
      },
    })

    return Response.json(affiliate, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
