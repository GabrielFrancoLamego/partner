import { redirect } from "next/navigation"

/** /partner/saques foi unificado em /partner/comissoes (aba "Saldo por Empresa") — mantido como redirect. */
export default function PartnerWithdrawalsPage() {
  redirect("/partner/comissoes")
}
