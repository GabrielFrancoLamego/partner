import type { SettlementPaymentMethod } from "@prisma/client"

export const PAYMENT_METHOD_LABELS_PT: Record<SettlementPaymentMethod, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência Bancária",
  CONSUMO: "Consumo Interno",
}
