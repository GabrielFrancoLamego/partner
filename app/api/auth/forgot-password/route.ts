import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"

const Schema = z.object({ email: z.string().trim().email() })

// Falha silenciosa (sendEmail nunca lança) — não expomos ao cliente se o email existe/foi enviado (evita enumeração de contas).
async function trySendResetEmail(email: string, link: string) {
  await sendEmail({
    to: email,
    subject: "Redefinição de senha — Tribuss",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size:20px; color:#3E2415;">Redefinir sua senha</h1>
        <p style="color:#555; font-size:14px; line-height:1.5;">
          Clique no link abaixo para escolher uma nova senha de acesso à Tribuss. Se você não pediu isso, ignore este email.
        </p>
        <p><a href="${link}" style="color:#F58220;">${link}</a></p>
      </div>
    `.trim(),
  })
}

/**
 * Fluxo público de "Esqueci minha senha" (login-content.tsx). Sempre responde
 * com sucesso genérico, exista ou não o email — diferente do fluxo do Admin
 * (lib/admin-user.ts#generatePasswordResetLink), que devolve o link direto na
 * UI porque quem aciona já é um operador de confiança. Aqui o link só pode
 * seguir por email (nunca na resposta HTTP), senão qualquer visitante
 * conseguiria resetar a senha de qualquer conta só sabendo o email.
 */
export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Informe um email válido" }, { status: 400 })
  }

  try {
    const origin = new URL(request.url).origin
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: { redirectTo: `${origin}/redefinir-senha` },
    })

    if (!error && data?.properties?.action_link) {
      await trySendResetEmail(parsed.data.email, data.properties.action_link)
    }
  } catch {
    // Idem — nunca vaza se o email existe ou se algo deu errado internamente.
  }

  return Response.json({ ok: true })
}
