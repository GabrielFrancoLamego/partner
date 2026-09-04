import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// Rotas de auth precisam ficar públicas (login/logout/signup) — o resto de
// /api/* exige sessão válida. A verificação fina de capacidade (quem pode
// aprovar saque, checklist, etc.) acontece dentro de cada route handler via
// lib/api-auth.ts + lib/permissions.ts.
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/logout", "/api/auth/callback"]

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request)

  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith("/api/")
  const isPublicApiRoute = PUBLIC_API_PATHS.some((path) => pathname.startsWith(path))

  if (isApiRoute && !isPublicApiRoute && !userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
