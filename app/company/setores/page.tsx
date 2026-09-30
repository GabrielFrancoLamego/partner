import { redirect } from "next/navigation"

/** /company/setores foi incorporado a /company/colaboradores — mantido como redirect para não quebrar favoritos/links antigos. */
export default function CompanySetoresPage() {
  redirect("/company/colaboradores")
}
