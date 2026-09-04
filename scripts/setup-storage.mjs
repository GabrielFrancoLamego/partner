// One-off: cria o bucket "uploads" no Supabase Storage se ainda não existir.
// Rodar com: node scripts/setup-storage.mjs
import { config } from "dotenv"
config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: buckets, error: listError } = await supabase.storage.listBuckets()
if (listError) {
  console.error("Erro ao listar buckets:", listError.message)
  process.exit(1)
}

async function ensureBucket(name, options) {
  const exists = buckets.some((b) => b.name === name)
  if (exists) {
    console.log(`Bucket "${name}" já existe.`)
    return
  }
  const { error: createError } = await supabase.storage.createBucket(name, options)
  if (createError) {
    console.error(`Erro ao criar bucket "${name}":`, createError.message)
    process.exit(1)
  }
  console.log(`Bucket "${name}" criado com sucesso.`)
}

await ensureBucket("uploads", {
  public: true,
  fileSizeLimit: "10MB",
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
})

// Público — fotos de perfil/capa/logo de Empresas, Colaboradores e Parceiros.
// Não é PII sensível como os documentos abaixo; precisa renderizar direto
// como <img src> sem custo de assinar URL a cada carregamento.
await ensureBucket("avatars-and-logos", {
  public: true,
  fileSizeLimit: "10MB",
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
})

// Privado — CPF/RG/comprovante de residência são PII sensível, acessados
// via signed URL (ver lib/storage.ts), nunca por URL pública direta.
await ensureBucket("employee-documents", {
  public: false,
  fileSizeLimit: "10MB",
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
})
