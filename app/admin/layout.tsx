import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { AdminShell } from "@/components/admin/admin-shell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect("/")
  if (user.role !== "ADMIN") redirect("/")

  return <AdminShell userName={user.name}>{children}</AdminShell>
}
