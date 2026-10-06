import { redirect } from "next/navigation"

/** "Descobrir Promo" foi unificado em /partner/promocoes (aba "Descobrir Novas Promoções") — mantido como redirect. */
export default function PartnerDiscoverRedirectPage() {
  redirect("/partner/promocoes?tab=descobrir")
}
