import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { recordAccess } from "@/lib/access-log"

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return Response.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return Response.json({ error: "Email ou senha incorretos" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    include: { partnerProfile: true, employeeProfile: true },
  })

  if (!user) {
    await supabase.auth.signOut()
    return Response.json({ error: "Conta autenticada, mas sem perfil configurado na plataforma" }, { status: 403 })
  }

  if (user.status !== "ACTIVE") {
    await supabase.auth.signOut()
    return Response.json({ error: "Conta inativa" }, { status: 403 })
  }

  await recordAccess(user.id, user.companyId)

  return Response.json(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
