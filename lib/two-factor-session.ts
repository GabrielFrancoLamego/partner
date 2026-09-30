import "server-only"
import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

/**
 * Selo de "2FA verificado nesta sessão" — cookie assinado (HMAC), não uma
 * sessão paralela: o Supabase já autenticou o usuário (senha correta) antes
 * de chegarmos aqui; este cookie só guarda se ele TAMBÉM passou pelo código
 * TOTP, e os layouts protegidos (ver app/partner/layout.tsx) exigem os dois
 * para quem tem twoFactorEnabled=true. Válido por 12h, escopado ao userId.
 */
const COOKIE_NAME = "tribuss_2fa_verified"
const MAX_AGE_SECONDS = 60 * 60 * 12

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "tribuss-2fa-fallback-secret"
}

function sign(userId: string, expiresAt: number) {
  return createHmac("sha256", secret()).update(`${userId}.${expiresAt}`).digest("hex")
}

export async function markTwoFactorVerified(userId: string) {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000
  const signature = sign(userId, expiresAt)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, `${userId}.${expiresAt}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function isTwoFactorVerified(userId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return false

  const [cookieUserId, expiresAtRaw, signature] = raw.split(".")
  if (!cookieUserId || !expiresAtRaw || !signature) return false
  if (cookieUserId !== userId) return false

  const expiresAt = Number(expiresAtRaw)
  if (!expiresAt || Date.now() > expiresAt) return false

  const expected = sign(userId, expiresAt)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function clearTwoFactorVerified() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
