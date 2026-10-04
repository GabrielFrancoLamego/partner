import "server-only"
import { prisma } from "./prisma"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Dia CLOSED (estabelecimento fechado) cadastrado no Calendário Operacional
 * (ver /company/configuracoes) — usado por lib/checklist-engine.ts pra não
 * gerar instâncias do dia e pelo sweep do fechamento pra não penalizar a
 * "não entrega" de um dia em que a empresa nem abriu.
 */
export async function isCompanyClosedOn(companyId: string, date: Date): Promise<boolean> {
  const event = await prisma.companyCalendarEvent.findUnique({
    where: { companyId_date: { companyId, date: startOfDay(date) } },
    select: { kind: true },
  })
  return event?.kind === "CLOSED"
}
