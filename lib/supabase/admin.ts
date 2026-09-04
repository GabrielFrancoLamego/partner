import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Client Supabase com a service role key — ignora RLS e pode gerenciar
 * usuários (auth.admin) e Storage. Nunca importar em código de cliente.
 * Usado pelo script de seed e por lib/storage.ts.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
