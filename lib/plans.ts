/**
 * Catálogo de planos SaaS da Tribuss. As 3 identidades de plano são fixas
 * (STANDARD/PREMIUM/ENTERPRISE — o mesmo valor livre gravado em
 * License.plan), mas limites e preços são configuráveis pelo Admin em
 * /admin/planos (model Plan no Prisma). `DEFAULT_PLAN_DEFINITIONS` só serve
 * de fallback caso uma linha da tabela não exista por algum motivo.
 */
export const PLAN_IDS = ["STANDARD", "PREMIUM", "ENTERPRISE"] as const
export type PlanId = (typeof PLAN_IDS)[number]

export type PlanDefinition = {
  id: PlanId
  label: string
  maxEmployees: number
  maxPartners: number
  oneTimePrice: number
  monthlyPrice: number
}

export const DEFAULT_PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  STANDARD: { id: "STANDARD", label: "Standard", maxEmployees: 5, maxPartners: 10, oneTimePrice: 300, monthlyPrice: 200 },
  PREMIUM: { id: "PREMIUM", label: "Premium", maxEmployees: 30, maxPartners: 60, oneTimePrice: 700, monthlyPrice: 500 },
  ENTERPRISE: { id: "ENTERPRISE", label: "Enterprise", maxEmployees: 50, maxPartners: 100, oneTimePrice: 1500, monthlyPrice: 1000 },
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value)
}

/** Preço recorrente mensal efetivo do plano dado o ciclo de cobrança contratado. */
export function monthlyRevenueFor(catalog: Record<PlanId, PlanDefinition>, plan: string): number {
  const def = isPlanId(plan) ? catalog[plan] : null
  if (!def) return 0
  // Ciclo anual é cobrado à vista mas equivale ao mesmo valor mensal reconhecido ao longo do ano.
  return def.monthlyPrice
}
