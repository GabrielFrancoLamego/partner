import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canAccessFinanceModule } from "@/lib/permissions"

const TYPE_LABELS: Record<string, string> = {
  SALARIO: "Salário Fixo",
  TAXA_SERVICO: "Taxa de Serviço",
  DIARIA: "Diária",
  COMPRA_DOMINGO: "Compra de Domingo",
  META: "Bonificação de Meta",
  VALE: "Vale/Adiantamento",
  HORA_EXTRA: "Hora Extra",
  BANCO_HORAS: "Banco de Horas",
  BONUS_ESPECIAL: "Bônus Especial",
  DESCONTO_ESPECIAL: "Desconto Especial",
  CUSTOM: "Lançamento Configurável",
}

/**
 * Contas a Pagar — consolida TODOS os compromissos financeiros pendentes da
 * empresa com data prevista, numa única lista ordenada por vencimento:
 * (a) Saques PIX de parceiros, (b) Salários/Adiantamentos/Diárias/Temporários
 * (Occurrence, já cobre todos esses tipos), (c) Metas/Bônus/Prêmios pendentes
 * (Occurrence type=META manual + GoalPayout, raro ficar PENDING).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    if (!canManageDailyOperations(user.role) && !canAccessFinanceModule(user)) throw new ApiError(403, "Sem permissão para esta ação")
    const companyId = user.companyId

    const [withdrawals, occurrences, goalPayouts] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { companyId, status: "PENDING" },
        include: { partner: { select: { id: true, name: true } } },
        orderBy: { requestDate: "asc" },
      }),
      prisma.occurrence.findMany({
        where: { companyId, employeeId: { not: null }, total: { not: null }, paymentStatus: "PENDING" },
        include: { employee: { select: { id: true, name: true } }, customType: { select: { name: true } } },
        orderBy: { expectedPaymentDate: "asc" },
      }),
      prisma.goalPayout.findMany({
        where: { companyId, status: "PENDING" },
        include: { employee: { select: { id: true, name: true } }, goal: { select: { name: true } } },
        orderBy: { expectedPaymentDate: "asc" },
      }),
    ])

    const rows = [
      ...withdrawals.map((w) => ({
        id: w.id,
        kind: "WITHDRAWAL" as const,
        recipientType: "PARTNER" as const,
        recipientId: w.partnerId,
        recipientName: w.partner.name,
        label: "Saque PIX de Parceiro",
        amount: Number(w.amount),
        dueDate: w.requestDate,
      })),
      ...occurrences.map((o) => ({
        id: o.id,
        kind: "OCCURRENCE" as const,
        recipientType: "EMPLOYEE" as const,
        recipientId: o.employeeId!,
        recipientName: o.employee!.name,
        label: o.type === "CUSTOM" ? o.customType?.name ?? "Lançamento" : TYPE_LABELS[o.type] ?? o.type,
        amount: Number(o.total),
        dueDate: o.expectedPaymentDate ?? o.date,
      })),
      ...goalPayouts.map((p) => ({
        id: p.id,
        kind: "GOAL_PAYOUT" as const,
        recipientType: "EMPLOYEE" as const,
        recipientId: p.employeeId,
        recipientName: p.employee.name,
        label: `Meta "${p.goal.name}"`,
        amount: Number(p.amount),
        dueDate: p.expectedPaymentDate ?? p.paidAt,
      })),
    ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    return Response.json(rows)
  } catch (error) {
    return handleApiError(error)
  }
}
