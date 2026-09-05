import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { isCompanyStaff } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { CompanyShell } from "@/components/company/company-shell"

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect("/")
  if (!isCompanyStaff(user.role) || !user.companyId) redirect("/")

  const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } })
  if (!company) redirect("/")

  const employeeProfile = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
    select: { canRegisterOccurrences: true },
  })

  return (
    <CompanyShell
      user={{
        id: user.id,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        companyName: company.name,
        canRegisterOccurrences: employeeProfile?.canRegisterOccurrences ?? false,
      }}
    >
      {children}
    </CompanyShell>
  )
}
