import "server-only"
import type { Company } from "@prisma/client"

/** Dias de carência: empresa Inadimplente mantém acesso total, só com banner de alerta. */
export const OVERDUE_GRACE_DAYS = 15

export type CompanyAccessState =
  | { kind: "OK" }
  | { kind: "OK_WITH_WARNING"; daysOverdue: number; daysRemaining: number }
  | { kind: "BLOCKED"; reason: "OVERDUE" | "BLOCKED" | "INACTIVE" | "ARCHIVED" }

/**
 * Deriva o estado de acesso da empresa a partir do status/overdueSince — chamado
 * a cada request em app/company/layout.tsx (não há infraestrutura de cron neste
 * projeto, então a regra dos 15 dias é sempre recalculada sob demanda, nunca
 * persistida). Isenção manual (License.isExempt) já impede o Admin de sequer
 * marcar a empresa como OVERDUE — ver lib/license-exemption.ts.
 */
export function getCompanyAccessState(company: Pick<Company, "status" | "overdueSince">): CompanyAccessState {
  if (company.status === "ARCHIVED") return { kind: "BLOCKED", reason: "ARCHIVED" }
  if (company.status === "BLOCKED") return { kind: "BLOCKED", reason: "BLOCKED" }
  if (company.status === "INACTIVE") return { kind: "BLOCKED", reason: "INACTIVE" }

  if (company.status === "OVERDUE") {
    const since = company.overdueSince ?? new Date()
    const daysOverdue = Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24))
    if (daysOverdue > OVERDUE_GRACE_DAYS) return { kind: "BLOCKED", reason: "OVERDUE" }
    return { kind: "OK_WITH_WARNING", daysOverdue, daysRemaining: OVERDUE_GRACE_DAYS - daysOverdue }
  }

  return { kind: "OK" }
}
