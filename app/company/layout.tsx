import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { isCompanyStaff } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { CompanyShell } from "@/components/company/company-shell"
import { AccessBlockedScreen } from "@/components/company/access-blocked-screen"
import { getCompanyAccessState } from "@/lib/company-access"

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect("/")
  if (!isCompanyStaff(user.role) || !user.companyId) redirect("/")

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { name: true, status: true, overdueSince: true, statusReason: true },
  })
  if (!company) redirect("/")

  // ADMIN não passa por aqui (bucket próprio em /admin) — só o time da
  // empresa sente o bloqueio/carência de inadimplência (ver lib/company-access.ts).
  const accessState = getCompanyAccessState(company)
  if (accessState.kind === "BLOCKED") {
    return <AccessBlockedScreen reason={accessState.reason} statusReason={company.statusReason} />
  }

  const employeeProfile = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
    select: { canRegisterOccurrences: true, isFinanceResponsible: true },
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
        isFinanceResponsible: employeeProfile?.isFinanceResponsible ?? false,
      }}
      billingWarning={
        accessState.kind === "OK_WITH_WARNING"
          ? { daysOverdue: accessState.daysOverdue, daysRemaining: accessState.daysRemaining }
          : null
      }
    >
      {children}
    </CompanyShell>
  )
}
