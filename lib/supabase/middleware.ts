import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Atualiza (refresh) a sessão do Supabase a partir dos cookies da requisição
 * e devolve uma NextResponse com os cookies já sincronizados. Chamado pelo
 * middleware.ts da raiz em toda requisição.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // getClaims() valida o JWT (diferente de getSession(), que só lê o cookie
  // sem verificar) — é o jeito seguro de checar autenticação no servidor.
  const { data } = await supabase.auth.getClaims()

  return { response, userId: data?.claims.sub ?? null }
}
