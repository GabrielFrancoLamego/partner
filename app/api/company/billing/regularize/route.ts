import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { notifyPlatformAdmins } from "@/lib/notifications"

/**
 * Disparado pelo botão "Regularizar Pendência" na tela de bloqueio
 * (components/company/access-blocked-screen.tsx). Sem gateway de pagamento
 * integrado (isenção manual, ver lib/license-exemption.ts), a única ação
 * possível hoje é avisar o Admin para que ele regularize manualmente.
 */
export async function POST() {
  try {
    const user = await requireCompanyStaff()

    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } })

    await notifyPlatformAdmins({
      type: "BILLING_OVERDUE",
      title: `Pedido de regularização — ${company?.name ?? "Empresa"}`,
      message: `${user.name} solicitou a regularização da pendência financeira da empresa "${company?.name}".`,
      linkUrl: `/admin/cadastros?tab=companies`,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
