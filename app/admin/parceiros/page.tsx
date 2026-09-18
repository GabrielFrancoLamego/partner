import { redirect } from "next/navigation"

/** A tabela de parceiros vive em /admin/cadastros (aba "Parceiros") — este redirect só existe para quem digitar a URL direto. */
export default function AdminParceirosRedirect() {
  redirect("/admin/cadastros?tab=partners")
}
