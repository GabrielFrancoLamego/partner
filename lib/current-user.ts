import "server-only"
import { prisma } from "./prisma"
import { createClient } from "./supabase/server"

/**
 * Liga o auth.uid() do Supabase ao registro correspondente em User (Prisma).
 * Retorna null se não houver sessão válida, ou se a sessão existir no
 * Supabase Auth mas ainda não tiver um User configurado na plataforma.
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims.sub) return null

  const user = await prisma.user.findUnique({
    where: { id: data.claims.sub },
    include: { partnerProfile: true, employeeProfile: true },
  })

  return user
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
