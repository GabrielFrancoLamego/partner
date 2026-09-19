import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError } from "@/lib/api-auth"
import { ensureTodayChecklistInstances } from "@/lib/checklist-engine"

/** Contagem leve para o badge piscante do atalho de Checklists no menu (ver company-shell.tsx). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    await ensureTodayChecklistInstances(user.companyId)

    const count = await prisma.checklist.count({
      where: { companyId: user.companyId, employeeId: user.id, status: "PENDING" },
    })

    return Response.json({ count })
  } catch (error) {
    return handleApiError(error)
  }
}
