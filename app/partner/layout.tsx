import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { PartnerShell } from "@/components/partner/partner-shell"

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect("/")
  if (user.role !== "PARTNER") redirect("/")

  return <PartnerShell user={{ id: user.id, name: user.name }}>{children}</PartnerShell>
}
