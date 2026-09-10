import "server-only"
import { prisma } from "./prisma"
import type { PublicRegistrationLink } from "@prisma/client"

/**
 * Resolve e valida um token de PublicRegistrationLink no momento da
 * submissão (não só na renderização da página) — cobre o caso de alguém
 * ter a página aberta numa aba e o link expirar/ser desativado enquanto
 * preenchia o formulário.
 */
export async function resolveValidLink(token: string | undefined | null): Promise<PublicRegistrationLink | null> {
  if (!token) return null
  const link = await prisma.publicRegistrationLink.findUnique({ where: { token } })
  if (!link) return null
  if (!link.active) return null
  if (link.expiresAt && link.expiresAt < new Date()) return null
  return link
}
