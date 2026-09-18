import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidEmail, isValidPhone } from "@/lib/validators"
import { resolveValidLink } from "@/lib/link-validation"
import { notifyPlatformAdmins } from "@/lib/notifications"

/**
 * Auto-cadastro público de uma NOVA empresa via link do tipo COMPANY_SIGNUP
 * (gerado em /admin/links, com plano/isenção pré-configurados). Diferente de
 * /join/company/[slug] (que já aponta para uma empresa existente), aqui ainda
 * não existe Company nenhuma — o pedido fica em PublicRegistrationRequest
 * (name = nome da empresa, desiredCompanySlug = slug pretendido, email/phone
 * = contato do futuro Master) até o Admin aprovar, momento em que a Company +
 * License + usuário Master são provisionados de fato (ver approve/route.ts).
 */
const CompanySignupSchema = z.object({
  companyName: z.string().trim().min(1, "Nome da empresa é obrigatório"),
  desiredSlug: z
    .string()
    .trim()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  masterName: z.string().trim().min(1, "Nome do responsável é obrigatório"),
  masterEmail: z.string().trim().refine(isValidEmail, "Email inválido"),
  masterPhone: z.string().trim().refine(isValidPhone, "WhatsApp inválido"),
  ref: z.string().trim().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const link = await resolveValidLink(token)
    if (!link || link.type !== "COMPANY_SIGNUP") {
      return Response.json({ error: "Este link de cadastro expirou ou não está mais ativo" }, { status: 410 })
    }

    const parsed = CompanySignupSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }

    const existingSlug = await prisma.company.findUnique({ where: { slug: parsed.data.desiredSlug } })
    if (existingSlug) {
      return Response.json({ error: "Já existe uma empresa com esse slug — escolha outro" }, { status: 409 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.masterEmail } })
    if (existingUser) {
      return Response.json({ error: "Já existe uma conta com este email" }, { status: 409 })
    }

    // Link especial do Afiliado para empresas: /join/company?token=X&ref=CODE
    // (mesmo link COMPANY_SIGNUP do Admin, com o código do afiliado anexado).
    let affiliateId: string | null = null
    if (parsed.data.ref) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: parsed.data.ref } })
      if (affiliate?.active) affiliateId = affiliate.id
    }

    await prisma.publicRegistrationRequest.create({
      data: {
        linkId: link.id,
        companyId: null,
        role: "COMPANY_MASTER",
        name: parsed.data.companyName,
        desiredCompanySlug: parsed.data.desiredSlug,
        masterName: parsed.data.masterName,
        email: parsed.data.masterEmail,
        phone: parsed.data.masterPhone,
        affiliateId,
      },
    })

    await notifyPlatformAdmins({
      type: "REGISTRATION_PENDING",
      title: "Nova empresa aguardando aprovação",
      message: `"${parsed.data.companyName}" solicitou cadastro na plataforma e aguarda aprovação.`,
      linkUrl: "/admin/cadastros?tab=approvals",
    })

    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Erro interno" }, { status: 500 })
  }
}
