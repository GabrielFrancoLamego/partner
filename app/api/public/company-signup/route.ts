import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidEmail, isValidPhone } from "@/lib/validators"

/**
 * Variante SEM token de /api/public/company-signup/[token] — usada pelo Link
 * Especial de Convite do Afiliado (/join/company?ref=CODE, sem token de
 * admin), mesmo padrão do /join/partner (que já aceita `ref` sozinho, sem
 * `token`). Plano/isenção usam o default (STANDARD, sem isenção) — quem quer
 * plano pré-configurado usa o link tokenizado gerado em /admin/links.
 */
const Schema = z.object({
  companyName: z.string().trim().min(1, "Nome da empresa é obrigatório"),
  desiredSlug: z
    .string()
    .trim()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
  masterName: z.string().trim().min(1, "Nome do responsável é obrigatório"),
  masterEmail: z.string().trim().refine(isValidEmail, "Email inválido"),
  masterPhone: z.string().trim().refine(isValidPhone, "WhatsApp inválido"),
  ref: z.string().trim().min(1, "Link de indicação inválido"),
})

export async function POST(request: Request) {
  try {
    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { code: parsed.data.ref } })
    if (!affiliate?.active) {
      return Response.json({ error: "Este link de indicação expirou ou não está mais ativo" }, { status: 410 })
    }

    const existingSlug = await prisma.company.findUnique({ where: { slug: parsed.data.desiredSlug } })
    if (existingSlug) {
      return Response.json({ error: "Já existe uma empresa com esse slug — escolha outro" }, { status: 409 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.masterEmail } })
    if (existingUser) {
      return Response.json({ error: "Já existe uma conta com este email" }, { status: 409 })
    }

    await prisma.publicRegistrationRequest.create({
      data: {
        linkId: null,
        companyId: null,
        role: "COMPANY_MASTER",
        name: parsed.data.companyName,
        desiredCompanySlug: parsed.data.desiredSlug,
        masterName: parsed.data.masterName,
        email: parsed.data.masterEmail,
        phone: parsed.data.masterPhone,
        affiliateId: affiliate.id,
      },
    })

    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Erro interno" }, { status: 500 })
  }
}
