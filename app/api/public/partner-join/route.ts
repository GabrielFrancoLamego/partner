import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidCpfOrCnpj, isValidEmail, isValidPhone } from "@/lib/validators"

/**
 * Auto-cadastro público de Parceiro (/join/partner, opcionalmente com
 * ?ref=CODIGO de um Afiliado) — sem autenticação. Parceiro não pertence a uma
 * empresa fixa, então companyId e linkId ficam null; a fila de aprovação é a
 * mesma que os demais PublicRegistrationRequest (Admin ou Master aprovam).
 */
const JoinPartnerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().refine(isValidEmail, "Email inválido"),
  phone: z.string().trim().refine(isValidPhone, "Telefone inválido"),
  document: z.string().trim().refine(isValidCpfOrCnpj, "CPF/CNPJ inválido"),
  ref: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = JoinPartnerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
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
    }

    await prisma.publicRegistrationRequest.create({
      data: {
        linkId: null,
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
