import { redirect } from "next/navigation"

/** /partner/saques foi movido para o acompanhamento em /partner/carteira/saques — mantido como redirect. */
export default function PartnerWithdrawalsPage() {
  redirect("/partner/carteira/saques")
}
