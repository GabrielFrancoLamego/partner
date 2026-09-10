import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidEmail, isValidPhone } from "@/lib/validators"

/**
 * Auto-cadastro público de colaborador para uma empresa específica
 * (/join/company/[slug]) — sem autenticação. Cria um PublicRegistrationRequest
 * pendente de aprovação do Admin/Master (mesma fila usada pelos links
 * tokenizados gerados no admin, só que sem exigir um PublicRegistrationLink
 * pré-criado — linkId fica null e o papel concedido é sempre EMPLOYEE).
 */
const JoinCompanySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().refine(isValidEmail, "Email inválido"),
  phone: z.string().trim().refine(isValidPhone, "Telefone inválido"),
  document: z.string().trim().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const company = await prisma.company.findUnique({ where: { slug } })
    if (!company || company.status !== "ACTIVE") {
      return Response.json({ error: "Empresa não encontrada" }, { status: 404 })
    }

    const parsed = JoinCompanySchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existingUser) {
      return Response.json({ error: "Já existe uma conta com este email" }, { status: 409 })
    }

    const existingPending = await prisma.publicRegistrationRequest.findFirst({
      where: { companyId: company.id, email: parsed.data.email, status: "PENDING_APPROVAL" },
    })
    if (existingPending) {
      return Response.json({ error: "Já existe um cadastro pendente com este email" }, { status: 409 })
    }

    await prisma.publicRegistrationRequest.create({
      data: {
        companyId: company.id,
        role: "EMPLOYEE",
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        document: parsed.data.document || null,
      },
    })

    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Erro interno" }, { status: 500 })
  }
}
