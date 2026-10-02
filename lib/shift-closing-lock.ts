import "server-only"
import { prisma } from "./prisma"

export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** O fechamento do expediente do dia (`date`) já foi concluído (status COMPLETED)? */
export async function isDayClosed(companyId: string, date: Date): Promise<boolean> {
  const closing = await prisma.shiftClosing.findUnique({
    where: { companyId_date: { companyId, date: startOfDay(date) } },
    select: { status: true },
  })
  return closing?.status === "COMPLETED"
}
