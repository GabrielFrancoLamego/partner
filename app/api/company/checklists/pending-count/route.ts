import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { ensureTodayChecklistInstances, eligibleSharedChecklistWhere } from "@/lib/checklist-engine"

/** Contagem leve para o badge piscante do atalho de Checklists no menu (ver company-shell.tsx). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    await ensureTodayChecklistInstances(user.companyId)

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { sectorId: true, tag: true } })

    const count = await prisma.checklist.count({
      where: {
        companyId: user.companyId,
        status: "PENDING",
        OR: [{ employeeId: user.id }, eligibleSharedChecklistWhere(profile?.tag ?? null, profile?.sectorId ?? null)],
      },
    })

    return Response.json({ count })
  } catch (error) {
    return handleApiError(error)
  }
}
