import "server-only"
import { createHmac, randomBytes } from "crypto"

/**
 * TOTP (RFC 6238) implementado sem dependência externa — HMAC-SHA1 sobre o
 * relógio em passos de 30s, compatível com Google Authenticator/Authy/1Password
 * (mesmo algoritmo, sem custo de instalar/auditar um pacote novo para isso).
 * Usado pela Autenticação em Duas Etapas do Parceiro (ver app/api/account/2fa/**).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const STEP_SECONDS = 30
const DIGITS = 6

export function generateTotpSecret(): string {
  const bytes = randomBytes(20) // 160 bits — tamanho padrão recomendado pela RFC 4226
  let bits = ""
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0")

  let secret = ""
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  }
  return secret
}

function base32Decode(base32: string): Buffer {
  const clean = base32.replace(/=+$/, "").toUpperCase()
  let bits = ""
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue
    bits += index.toString(2).padStart(5, "0")
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
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

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0")
}

/** Verifica um código de 6 dígitos aceitando ±1 passo (30s) de deriva de relógio. */
export function verifyTotpCode(secret: string, code: string, windowSteps = 1): boolean {
  const cleanCode = code.replace(/\D/g, "")
  if (cleanCode.length !== DIGITS) return false

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS)
  for (let errorWindow = -windowSteps; errorWindow <= windowSteps; errorWindow++) {
    if (totpAt(secret, counter + errorWindow) === cleanCode) return true
  }
  return false
}

/** URI `otpauth://` para gerar o QR Code lido pelo app autenticador. */
export function buildTotpUri(secret: string, accountLabel: string) {
  const issuer = "Tribuss"
  const label = encodeURIComponent(`${issuer}:${accountLabel}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`
}
