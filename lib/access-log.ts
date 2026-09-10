import "server-only"
import { prisma } from "./prisma"

/**
 * Registra um acesso (login por senha ou OAuth) — chamado nos dois pontos de
 * entrada de sessão (app/api/auth/login e app/api/auth/callback). Grava tanto
 * `User.lastActiveAt` (usado pelo DAU/MAU existente) quanto uma linha em
 * `AccessLog` (histórico de eventos), para o dashboard do Admin conseguir
 * mostrar "usuários únicos" e "número de acessos" como métricas distintas.
 */
export async function recordAccess(userId: string, companyId: string | null) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }),
    prisma.accessLog.create({ data: { userId, companyId } }),
  ])
}
