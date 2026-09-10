import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidEmail, isValidPhone } from "@/lib/validators"
import { resolveValidLink } from "@/lib/link-validation"

/**
 * Auto-cadastro público de colaborador para uma empresa específica
 * (/join/company/[slug]) — sem autenticação. Cria um PublicRegistrationRequest
 * pendente de aprovação do Admin/Master. Opcionalmente recebe `token` de um
 * PublicRegistrationLink do tipo EMPLOYEE_SIGNUP (gerado em /admin/links) —
 * quando presente e válido, herda setor/origem e é revalidado (ativo + não
 * expirado) nesta submissão, não só na renderização da página.
 */
const JoinCompanySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().refine(isValidEmail, "Email inválido"),
  phone: z.string().trim().refine(isValidPhone, "Telefone inválido"),
  document: z.string().trim().optional(),
  token: z.string().trim().optional(),
  sectorId: z.string().trim().optional(),
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

    let linkId: string | null = null
    let sectorId: string | null = parsed.data.sectorId || null
    if (parsed.data.token) {
      const link = await resolveValidLink(parsed.data.token)
      if (!link) {
        return Response.json({ error: "Este link de cadastro expirou ou não está mais ativo" }, { status: 410 })
      }
      if (link.type === "EMPLOYEE_SIGNUP" && link.companyId === company.id) {
        linkId = link.id
        sectorId = sectorId ?? link.sectorId
      }
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
        linkId,
        sectorId,
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
