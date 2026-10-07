/**
 * Helpers compartilhados pelos scripts de auditoria E2E (scripts/audit-e2e-*.ts):
 * login real via Supabase (cookies @supabase/ssr), fetch autenticado, TOTP de
 * teste e o coletor de resultados. Ver scripts/audit-e2e-simulation.ts para o
 * primeiro conjunto de testes (RBAC, multi-tenancy, 2FA, empresa suspensa).
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { createHmac } from "crypto"
import { createServerClient } from "@supabase/ssr"

export const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000"
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const PASSWORD = "123456"

// ---------------------------------------------------------------------------
// TOTP (mesmo algoritmo de lib/totp.ts)
// ---------------------------------------------------------------------------
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
function base32Decode(base32: string): Buffer {
  const clean = base32.replace(/=+$/, "").toUpperCase()
  let bits = ""
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue
    bits += index.toString(2).padStart(5, "0")
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac("sha1", key).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)
  return String(binary % 10 ** 6).padStart(6, "0")
}
export function currentTotpCode(secret: string) {
  return totpAt(secret, Math.floor(Date.now() / 1000 / 30))
}

// ---------------------------------------------------------------------------
// CPF válido aleatório (mesmo checksum de lib/validators.ts)
// ---------------------------------------------------------------------------
export function randomValidCpf(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const calc = (nums: number[]) => {
    let sum = 0
    for (let i = 0; i < nums.length; i++) sum += nums[i] * (nums.length + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  const d1 = calc(digits)
  const d2 = calc([...digits, d1])
  return [...digits, d1, d2].join("")
}

// ---------------------------------------------------------------------------
// Coletor de resultados
// ---------------------------------------------------------------------------
export type Outcome = { phase: string; name: string; pass: boolean; detail?: string }
export const results: Outcome[] = []
export function record(phase: string, name: string, pass: boolean, detail?: string) {
  results.push({ phase, name, pass, detail })
  console.log(`${pass ? "✓" : "✗"} [${phase}] ${name}${detail ? " — " + detail : ""}`)
}
export async function check(phase: string, name: string, fn: () => Promise<boolean | string>) {
  try {
    const r = await fn()
    if (typeof r === "string") record(phase, name, false, r)
    else record(phase, name, r)
  } catch (e: any) {
    record(phase, name, false, `exceção: ${e?.message ?? e}`)
  }
}
export function printSummary(label: string) {
  const total = results.length
  const passed = results.filter((r) => r.pass).length
  console.log(`\n=== RESUMO ${label}: ${passed}/${total} passaram ===`)
  const failed = results.filter((r) => !r.pass)
  if (failed.length) {
    console.log("Falhas:")
    for (const f of failed) console.log(`  ✗ [${f.phase}] ${f.name} — ${f.detail ?? ""}`)
  }
}

// ---------------------------------------------------------------------------
// Login real via Supabase + fetch autenticado (cookie-jar mutável — necessário
// para fluxos como o 2FA, onde a API devolve um Set-Cookie que a PRÓXIMA
// requisição da mesma sessão precisa carregar).
// ---------------------------------------------------------------------------
export type Session = { jar: Map<string, string>; userId: string; email: string }

export async function loginAs(email: string, password = PASSWORD): Promise<Session> {
  const jar = new Map<string, string>()
  const supa = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  })
  const { data, error } = await supa.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) throw new Error(`login falhou (${email}): ${error?.message}`)
  return { jar, userId: data.user.id, email }
}

export async function api(session: Session | null, method: string, path: string, body?: unknown, isForm = false) {
  const headers: Record<string, string> = {}
  if (session) headers.Cookie = [...session.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
  let payload: BodyInit | undefined
  if (isForm) payload = body as BodyInit
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload })
  if (session) {
    for (const setCookie of res.headers.getSetCookie()) {
      const [pair] = setCookie.split(";")
      const eq = pair.indexOf("=")
      if (eq > 0) session.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }
  let json: any = null
  try {
    json = await res.json()
  } catch {
    /* corpo vazio ou não-JSON */
  }
  return { status: res.status, json }
}

export function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// ---------------------------------------------------------------------------
// Quitação no Financeiro (POST /api/company/finance/settle*): multipart com
// forma de pagamento + comprovante PNG (1x1) — o comprovante é obrigatório.
// ---------------------------------------------------------------------------
const ONE_PX_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
export function settleForm(fields: Record<string, string>, opts: { method?: string | null; withFile?: boolean } = {}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  const method = opts.method === undefined ? "PIX" : opts.method
  if (method) form.append("paymentMethod", method)
  if (opts.withFile !== false) form.append("file", new File([ONE_PX_PNG], "comprovante.png", { type: "image/png" }))
  return form
}

/**
 * Testes de ponto montam batidas "há N minutos"; nos primeiros N minutos após a
 * meia-noite elas caem no dia anterior e a API (que só olha o dia atual) as ignora.
 * Nessa janela o passo é registrado como ignorado em vez de falhar por artefato do relógio.
 */
export function crossesMidnight(minutesBack: number) {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() < minutesBack + 5
}
