import "server-only"
import { createAdminClient } from "./supabase/admin"

const BUCKET = "uploads"

/**
 * Sobe um arquivo (File do FormData) para o bucket "uploads" do Supabase
 * Storage e devolve a URL pública. Usa o client admin porque quem chama
 * aqui já passou por requireUser()/requireCapability() na própria API.
 */
export async function uploadImage(
  folder:
    | "checklists"
    | "receipts"
    | "occurrences"
    | "posts"
    | "justifications"
    | "rewards"
    | "closings"
    | "programs"
    | "internal-programs"
    | "promotions",
  file: File,
) {
  const supabase = createAdminClient()
  const extension = file.name.split(".").pop() || "jpg"
  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  })

  if (error) throw new Error(`Falha ao subir imagem: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

const ALLOWED_PUBLIC_DOC_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"]

/**
 * Sobe um PDF público (regulamento de Program, apresentação, etc) para o
 * mesmo bucket público "uploads" — diferente de uploadEmployeeDocument, aqui
 * o conteúdo é intencionalmente público (parceiros/clientes precisam abrir
 * sem login), então devolve a URL pública direta, não um path assinado.
 */
export async function uploadPublicDocument(folder: "programs" | "internal-programs" | "promotions", file: File) {
  if (!ALLOWED_PUBLIC_DOC_MIME_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado — envie uma imagem (JPG/PNG/WEBP) ou PDF.")
  }

  const supabase = createAdminClient()
  const extension = file.name.split(".").pop() || "bin"
  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Falha ao subir arquivo: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

const AVATARS_BUCKET = "avatars-and-logos"
const ALLOWED_AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]

export type AvatarOwnerType = "company" | "employee" | "partner"

/**
 * Sobe uma foto de perfil, capa ou logo (Empresa, Colaborador ou Parceiro)
 * para o bucket público "avatars-and-logos" e devolve a URL pública direta.
 * Diferente dos documentos de RH abaixo, essas imagens não são PII sensível
 * e precisam renderizar como <img src> sem o custo/latência de assinar uma
 * URL a cada carregamento — por isso o bucket é público e a própria URL
 * (não um path) é o que fica salvo no Prisma.
 */
export async function uploadAvatar(ownerType: AvatarOwnerType, ownerId: string, field: string, file: File) {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado — envie uma imagem (JPG/PNG/WEBP).")
  }

  const supabase = createAdminClient()
  const extension = file.name.split(".").pop() || "jpg"
  const path = `${ownerType}/${ownerId}/${field}-${Date.now()}.${extension}`

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw new Error(`Falha ao subir imagem: ${error.message}`)

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

const EMPLOYEE_DOCS_BUCKET = "employee-documents"
const ALLOWED_DOC_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"]

export type EmployeeDocField = "cpfDocUrl" | "rgDocUrl" | "proofOfResidenceUrl"

/**
 * Sobe um documento de RH do colaborador (CPF, RG/CNH, comprovante de
 * residência) para o bucket privado "employee-documents" e devolve o PATH do
 * objeto — é o path (não uma URL) que fica salvo no EmployeeProfile.
 * O bucket é privado porque esses arquivos contêm PII sensível; a
 * visualização gera uma signed URL de curta duração sob demanda via
 * getSignedDocumentUrl(), nunca uma URL permanente. A foto de perfil
 * (photoUrl) NÃO entra aqui — vai pelo bucket público via uploadAvatar().
 */
export async function uploadEmployeeDocument(userId: string, field: EmployeeDocField, file: File) {
  if (!ALLOWED_DOC_MIME_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado — envie uma imagem (JPG/PNG/WEBP) ou PDF.")
  }

  const supabase = createAdminClient()
  const extension = file.name.split(".").pop() || "bin"
  const path = `${userId}/${field}-${Date.now()}.${extension}`

  const { error } = await supabase.storage.from(EMPLOYEE_DOCS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw new Error(`Falha ao subir documento: ${error.message}`)

  return path
}

/**
 * Gera uma signed URL de curta duração (default 60 min) para um documento já
 * salvo no bucket privado "employee-documents", a partir do path gravado em
 * EmployeeProfile. Chamada sob demanda (ex: clique em "Visualizar Documento")
 * — a URL nunca é persistida, só o path.
 */
export async function getSignedDocumentUrl(path: string, expiresInSeconds = 60 * 60) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(EMPLOYEE_DOCS_BUCKET).createSignedUrl(path, expiresInSeconds)

  if (error || !data) throw new Error(`Falha ao gerar link do documento: ${error?.message ?? ""}`)
  return data.signedUrl
}
