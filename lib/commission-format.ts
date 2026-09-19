import type { CommissionFormat, CommissionType } from "@prisma/client"

/**
 * "Tipo de Comissão" (FIXED/VARIABLE/BOTH) é derivado automaticamente do
 * "Formato do Valor" (%/R$/unidade) + se há um valor fixo extra combinado —
 * unifica os dois seletores que antes eram preenchidos independentemente
 * (podendo formar combinações sem sentido, ex: FIXED + PERCENTAGE) em uma
 * única fonte de verdade. Usado por toda rota que cria/edita um Program.
 */
export function deriveCommissionType(commissionFormat: CommissionFormat, hasFixedExtra: boolean): CommissionType {
  if (commissionFormat === "PERCENTAGE") return hasFixedExtra ? "BOTH" : "VARIABLE"
  return "FIXED"
}

export type ReferralCommissionInput = {
  commissionType: CommissionType
  commissionFormat: CommissionFormat
  commissionValue: number // valor base do Program (ou override do nível)
  fixedValue: number | null // parte fixa extra quando commissionType = BOTH
}

/**
 * Calcula o valor da comissão de uma indicação "pura" ao Programa de
 * Parceria (sem Promotion específica, registrada no Scanner PDV) a partir do
 * Valor Total da Conta do cliente — task: "mesmo para programas de comissão
 * fixa, exigir o valor da conta para fins de registro do faturamento gerado".
 * PRODUCT_UNIT não gera R$ (é bonificação em unidade/produto) — commissionValue
 * já representa a quantidade de unidades, não precisa de cálculo sobre `amount`.
 */
export function computeReferralCommissionValue(program: ReferralCommissionInput, billAmount: number): number {
  const base =
    program.commissionFormat === "PERCENTAGE"
      ? Math.round(billAmount * (program.commissionValue / 100) * 100) / 100
      : program.commissionFormat === "FIXED_VALUE"
        ? program.commissionValue
        : program.commissionValue // PRODUCT_UNIT: quantidade, não R$

  if (program.commissionType === "BOTH" && program.fixedValue) {
    return Math.round((base + program.fixedValue) * 100) / 100
  }
  return base
}
