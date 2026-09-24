import { redirect } from "next/navigation"

/** /company/pdv foi renomeado para /company/scanner — mantido como redirect para não quebrar favoritos/links antigos. */
export default function CompanyPdvPage() {
  redirect("/company/scanner")
}
