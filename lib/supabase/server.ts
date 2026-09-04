import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Client Supabase para uso em Server Components e Route Handlers.
 * Precisa ser criado a cada requisição (nunca reaproveitado entre requests).
 *
 * `setAll` roda dentro de um try/catch porque Server Components não podem
 * escrever cookies — nesse caso o middleware (lib/supabase/middleware.ts)
 * é quem garante o refresh da sessão. Em Route Handlers, `cookies().set()`
 * funciona normalmente.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado de um Server Component — sem problema, o middleware cuida do refresh.
        }
      },
    },
  })
}
