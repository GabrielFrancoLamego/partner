import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isValidEmail, isValidPhone } from "@/lib/validators"
import { resolveValidLink } from "@/lib/link-validation"
import { createPlatformUser, deleteAuthUser } from "@/lib/admin-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { payAffiliateSignupBonus } from "@/lib/affiliate"

/**
 * Etapa 1 do cadastro de Parceiro — Nome, Email e WhatsApp bastam para criar
 * a conta e liberar a navegação (ver o botão "Cadastrar como Parceiro" na
 * tela de login e components/public/partner-join-form.tsx). Diferente do
 * fluxo antigo (PublicRegistrationRequest + aprovação do Admin), aqui a conta
 * já nasce ativa: CPF/PIX/dados bancários só são exigidos depois, ao aderir a
 * um programa ou pedir o 1º saque (Etapa 2, ver lib/partner-adesao.ts).
 */
const Schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().refine(isValidEmail, "Email inválido"),
  phone: z.string().trim().refine(isValidPhone, "Telefone inválido"),
  ref: z.string().trim().optional(),
  token: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }
    const { name, email, phone, ref, token } = parsed.data

    if (token) {
      const link = await resolveValidLink(token)
      if (!link) return Response.json({ error: "Este link de indicação expirou ou não está mais ativo" }, { status: 410 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return Response.json({ error: "Já existe uma conta com este email" }, { status: 409 })

    let affiliateId: string | null = null
    if (ref) {
      const affiliate = await prisma.affiliate.findUnique({ where: { code: ref } })
      if (affiliate?.active) affiliateId = affiliate.id
      else return Response.json({ error: "Este link de indicação expirou ou não está mais ativo" }, { status: 410 })
    }

    const newUser = await createPlatformUser({
      email,
      name,
      role: "PARTNER",
      phone,
      fullName: name,
      whatsapp: phone,
      contactEmail: email,
    })

    if (affiliateId) {
      const partnerProfile = await prisma.partnerProfile.update({ where: { userId: newUser.id }, data: { affiliateId } })
      await payAffiliateSignupBonus(affiliateId, partnerProfile.id).catch(() => {})
    }

    // Gera um link de acesso (Supabase "recovery") e devolve pro client redirecionar
    // o próprio navegador — mesmo mecanismo de /redefinir-senha, que estabelece a
    // sessão automaticamente ao carregar a página; assim o parceiro já entra
    // navegando sem precisar de outra etapa/senha separada.
    const origin = new URL(request.url).origin
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/redefinir-senha` },
    })

    if (error || !data?.properties?.action_link) {
      await deleteAuthUser(newUser.id).catch(() => {})
      await prisma.user.delete({ where: { id: newUser.id } }).catch(() => {})
      return Response.json({ error: "Não foi possível liberar o acesso agora. Tente novamente." }, { status: 500 })
    }

    return Response.json({ ok: true, redirectUrl: data.properties.action_link }, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Erro interno" }, { status: 500 })
  }
}
