import "server-only"
import { prisma } from "./prisma"
import { DEFAULT_PLAN_DEFINITIONS, PLAN_IDS, type PlanDefinition, type PlanId } from "./plans"

/** Lê o catálogo de planos configurado em /admin/planos, com fallback para os defaults se uma linha faltar. */
export async function getPlanCatalog(): Promise<Record<PlanId, PlanDefinition>> {
  const rows = await prisma.plan.findMany()
  const catalog = { ...DEFAULT_PLAN_DEFINITIONS }

  for (const id of PLAN_IDS) {
    const row = rows.find((r) => r.id === id)
    if (row) {
      catalog[id] = {
        id,
        label: row.label,
        maxEmployees: row.maxEmployees,
        maxPartners: row.maxPartners,
        oneTimePrice: Number(row.oneTimePrice),
        monthlyPrice: Number(row.monthlyPrice),
      }
    }
  }

  return catalog
}
