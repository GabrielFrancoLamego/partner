import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { PartnerShell } from "@/components/partner/partner-shell"
import { isTwoFactorVerified } from "@/lib/two-factor-session"

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect("/")
  if (user.role !== "PARTNER") redirect("/")

  if (user.twoFactorEnabled && !(await isTwoFactorVerified(user.id))) {
    redirect("/verificar-2fa")
  }

  const [affiliate, profile] = await Promise.all([
    prisma.affiliate.findFirst({ where: { partnerProfile: { userId: user.id } }, select: { id: true, active: true } }),
    prisma.partnerProfile.findUnique({ where: { userId: user.id }, select: { photoUrl: true } }),
  ])

  return (
    <PartnerShell user={{ id: user.id, name: user.name, isAffiliate: Boolean(affiliate?.active), photoUrl: profile?.photoUrl ?? null }}>
      {children}
    </PartnerShell>
  )
}
