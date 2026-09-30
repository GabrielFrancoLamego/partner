import "server-only"
import { prisma } from "./prisma"
import { ApiError } from "./api-auth"

export type PartnerAdesaoProfile = {
  cpf: string | null
  pixKey: string | null
  bankName: string | null
  agency: string | null
  accountNumber: string | null
}

/**
 * Etapa 2 do cadastro (ver app/api/public/partner-quick-signup) — CPF + (Chave
 * PIX OU dados bancários completos) são exigidos só quando o parceiro tenta
 * "Aderir ao Programa" ou pedir o 1º saque, nunca no cadastro inicial.
 */
export function isPartnerAdesaoComplete(profile: PartnerAdesaoProfile): boolean {
  if (!profile.cpf) return false
  const hasPix = Boolean(profile.pixKey)
  const hasBank = Boolean(profile.bankName && profile.agency && profile.accountNumber)
  return hasPix || hasBank
}

/** Lança 428 (código que o client reconhece pra abrir o modal de completar cadastro) se a Etapa 2 ainda não foi preenchida. */
export async function requirePartnerAdesaoComplete(userId: string) {
  const profile = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { cpf: true, pixKey: true, bankName: true, agency: true, accountNumber: true },
  })
  if (!profile || !isPartnerAdesaoComplete(profile)) {
    throw new ApiError(428, "Complete seu CPF e Chave PIX (ou dados bancários) para continuar")
  }
}
