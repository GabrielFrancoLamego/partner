import "server-only"
import { prisma } from "./prisma"

/**
 * Sem infraestrutura de cron neste projeto — a reversão de isenções vencidas
 * é feita sob demanda (lazy), disparada nos pontos de entrada que listam
 * empresas/licenças (GET /api/admin/companies, dashboard). Idempotente e
 * barata (um updateMany condicional), segura para chamar em toda request.
 */
export async function revertExpiredExemptions() {
  await prisma.license.updateMany({
    where: { isExempt: true, exemptionExpiresAt: { lte: new Date() } },
    data: { isExempt: false, exemptionMonths: null, exemptionExpiresAt: null },
  })
}

export function computeExemptionExpiresAt(months: number): Date {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date
}
