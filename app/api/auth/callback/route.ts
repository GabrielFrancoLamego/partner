import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { recordAccess } from "@/lib/access-log"

/**
 * Callback do OAuth (Google). O Supabase redireciona pra cá com `?code=...`
 * depois do consentimento; trocamos o code por sessão e conferimos se já
 * existe um User cadastrado na plataforma para esse email — mesma regra do
 * login por senha em app/api/auth/login/route.ts (conta autenticada no
 * Supabase não é o mesmo que ter perfil configurado no Tribuss).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error")

  if (oauthError) {
    return Response.redirect(`${origin}/?authError=${encodeURIComponent(oauthError)}`)
  }

  if (!code) {
    return Response.redirect(`${origin}/?authError=missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return Response.redirect(`${origin}/?authError=exchange_failed`)
  }

  const user = await prisma.user.findUnique({ where: { id: data.user.id } })

  if (!user) {
    await supabase.auth.signOut()
    return Response.redirect(`${origin}/?authError=no_profile`)
  }

  if (user.status !== "ACTIVE") {
    await supabase.auth.signOut()
    return Response.redirect(`${origin}/?authError=inactive`)
  }

  await recordAccess(user.id, user.companyId)

  return Response.redirect(`${origin}/`)
}
