import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidCpfOrCnpj, isValidEmail, isValidPhone } from "@/lib/validators"
import { resolveValidLink } from "@/lib/link-validation"
import { notifyCompanyManagement, notifyPlatformAdmins } from "@/lib/notifications"

/**
 * Auto-cadastro público de Parceiro (/join/partner ou /join/partner/[affiliateCode],
 * opcionalmente com ?ref=CODIGO de Afiliado ou ?token=X de um link
 * PARTNER_GENERIC/PARTNER_FOR_COMPANY gerado em /admin/links) — sem
 * autenticação. companyId só é preenchido quando o link é PARTNER_FOR_COMPANY
 * (parceiro pré-vinculado a uma empresa específica); PARTNER_GENERIC e o
 * cadastro direto sem token deixam null (parceiro não pertence a uma
 * empresa fixa — atua por indicação, ver model Referral).
 */
const JoinPartnerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().refine(isValidEmail, "Email inválido"),
  phone: z.string().trim().refine(isValidPhone, "Telefone inválido"),
  document: z.string().trim().refine(isValidCpfOrCnpj, "CPF/CNPJ inválido"),
  ref: z.string().trim().optional(),
  token: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = JoinPartnerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }

    let linkId: string | null = null
    let companyId: string | null = null
    if (parsed.data.token) {
      const link = await resolveValidLink(parsed.data.token)
      if (!link) {
        return Response.json({ error: "Este link de indicação expirou ou não está mais ativo" }, { status: 410 })
      }
      if (link.type === "PARTNER_GENERIC" || link.type === "PARTNER_FOR_COMPANY") {
        linkId = link.id
        // Bug corrigido: o link PARTNER_FOR_COMPANY carregava a empresa de
        // destino, mas o cadastro pendente nascia sempre com companyId=null
        // — a vinculação era perdida antes mesmo da aprovação do Admin.
        companyId = link.type === "PARTNER_FOR_COMPANY" ? link.companyId : null
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existingUser) {
      return Response.json({ error: "Já existe uma conta com este email" }, { status: 409 })
    }

    // Restrição: um colaborador não pode virar parceiro comercial DA MESMA
    // empresa em que trabalha (identidade cruzada pelo CPF/CNPJ, já que o
    // cadastro de parceiro pode usar um email diferente do de colaborador).
    // Outras empresas da plataforma continuam permitidas.
    if (companyId) {
      const employeeAtSameCompany = await prisma.employeeProfile.findFirst({
        where: { cpf: parsed.data.document, user: { companyId } },
      })
      if (employeeAtSameCompany) {
        return Response.json(
          { error: "Colaboradores não podem se cadastrar como parceiro comercial da própria empresa" },
          { status: 409 },
        )
      }
    }

    const existingPending = await prisma.publicRegistrationRequest.findFirst({
      where: { email: parsed.data.email, role: "PARTNER", status: "PENDING_APPROVAL" },
    })
    if (existingPending) {
      return Response.json({ error: "Já existe um cadastro pendente com este email" }, { status: 409 })
    }

    let affiliateId: string | null = null
    if (parsed.data.ref) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: parsed.data.ref } })
      if (affiliate?.active) affiliateId = affiliate.id
      else {
        return Response.json({ error: "Este link de indicação expirou ou não está mais ativo" }, { status: 410 })
      }
    }

    await prisma.publicRegistrationRequest.create({
      data: {
        linkId,
        companyId,
        role: "PARTNER",
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        document: parsed.data.document,
        affiliateId,
      },
    })

    const notifyPayload = {
      type: "REGISTRATION_PENDING" as const,
      title: "Novo cadastro de parceiro pendente",
      message: `${parsed.data.name} solicitou cadastro como parceiro e aguarda aprovação.`,
      linkUrl: "/admin/cadastros?tab=approvals",
    }
    if (companyId) await notifyCompanyManagement(companyId, notifyPayload)
    else await notifyPlatformAdmins(notifyPayload)

    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Erro interno" }, { status: 500 })
  }
}
