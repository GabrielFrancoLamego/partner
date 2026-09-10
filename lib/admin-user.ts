import "server-only"
import { Resend } from "resend"
import type { PartnerType, Role } from "@prisma/client"
import { prisma } from "./prisma"
import { createAdminClient } from "./supabase/admin"
import { ApiError } from "./api-auth"

const DEFAULT_PASSWORD = "123456" // ambiente local de testes — mesma convenção do scripts/seed.mjs

type CreatePlatformUserInput = {
  email: string
  name: string
  role: Role
  companyId?: string | null
  partnerType?: PartnerType
  document?: string
  phone?: string
  fullName?: string
  nickname?: string
  whatsapp?: string
  contactEmail?: string
  cpf?: string
  bio?: string
}

/**
 * Provisiona um usuário completo: conta real no Supabase Auth (senha padrão
 * de ambiente local) + registro User no Prisma + perfil (Partner/Employee)
 * quando aplicável. Usado pelas telas de Cadastros e pela aprovação de
 * PublicRegistrationRequest.
 */
export async function createPlatformUser(input: CreatePlatformUserInput) {
  const supabaseAdmin = createAdminClient()

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  })

  if (error || !data.user) {
    if (error?.message.includes("already been registered") || error?.status === 422) {
      throw new ApiError(409, "Já existe uma conta com este email")
    }
    throw new ApiError(500, error?.message ?? "Falha ao criar conta de autenticação")
  }

  try {
    const user = await prisma.user.create({
      data: {
        id: data.user.id,
        email: input.email,
        name: input.name,
        phone: input.phone ?? null,
        role: input.role,
        companyId: input.companyId ?? null,
      },
    })

    if (input.role === "EMPLOYEE") {
      await prisma.employeeProfile.create({ data: { userId: user.id } })
    }

    if (input.role === "PARTNER") {
      await prisma.partnerProfile.create({
        data: {
          userId: user.id,
          partnerType: input.partnerType ?? "INDIVIDUAL",
          document: input.document,
          phone: input.phone,
          fullName: input.fullName,
          nickname: input.nickname,
          whatsapp: input.whatsapp,
          email: input.contactEmail,
          cpf: input.cpf,
          bio: input.bio,
        },
      })
    }

    return user
  } catch (dbError) {
    // Rollback da conta de auth se a escrita no Postgres falhar, para não
    // deixar um usuário "fantasma" sem registro correspondente.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {})
    throw dbError
  }
}

/**
 * Envia o link de acesso/redefinição por email via Resend, quando
 * RESEND_API_KEY estiver configurada. Sem a chave (ambiente local/sem
 * provedor contratado ainda), não faz nada — o link já é sempre devolvido
 * para a UI, para cópia e envio manual, mesmo padrão usado em todo o app.
 */
async function trySendInviteEmail(email: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || "Tribuss <onboarding@resend.dev>",
      to: email,
      subject: "Seu acesso à plataforma Tribuss",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size:20px; color:#3E2415;">Bem-vindo(a) à Tribuss</h1>
          <p style="color:#555; font-size:14px; line-height:1.5;">
            Clique no link abaixo para definir sua senha e acessar a plataforma:
          </p>
          <p><a href="${link}" style="color:#F58220;">${link}</a></p>
        </div>
      `.trim(),
    })
  } catch {
    // Falha silenciosa — o link já foi gerado e devolvido para a UI de qualquer forma.
  }
}

/** Gera um link de redefinição de senha e tenta enviá-lo por email (ver trySendInviteEmail); o link é sempre devolvido para a UI. */
export async function generatePasswordResetLink(email: string) {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email })

  if (error || !data) {
    throw new ApiError(500, error?.message ?? "Falha ao gerar link de redefinição")
  }

  const link = data.properties.action_link
  await trySendInviteEmail(email, link)
  return link
}

export async function deleteAuthUser(userId: string) {
  const supabaseAdmin = createAdminClient()
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
}
