import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidCpfOrCnpj, isValidEmail, isValidPhone } from "@/lib/validators"
import { resolveValidLink } from "@/lib/link-validation"

/**
 * Auto-cadastro público de Parceiro (/join/partner ou /join/partner/[affiliateCode],
 * opcionalmente com ?ref=CODIGO de Afiliado ou ?token=X de um link
 * PARTNER_GENERIC/PARTNER_FOR_COMPANY gerado em /admin/links) — sem
 * autenticação. Parceiro não pertence a uma empresa fixa, então companyId
 * fica sempre null; linkId é gravado só para atribuição/relatório.
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
    if (parsed.data.token) {
      const link = await resolveValidLink(parsed.data.token)
      if (!link) {
        return Response.json({ error: "Este link de indicação expirou ou não está mais ativo" }, { status: 410 })
      }
      if (link.type === "PARTNER_GENERIC" || link.type === "PARTNER_FOR_COMPANY") {
        linkId = link.id
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existingUser) {
      return Response.json({ error: "Já existe uma conta com este email" }, { status: 409 })
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
        companyId: null,
        role: "PARTNER",
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        document: parsed.data.document,
        affiliateId,
      },
    })

    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Erro interno" }, { status: 500 })
  }
}
