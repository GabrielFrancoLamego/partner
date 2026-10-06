import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireFinanceAccess, handleApiError } from "@/lib/api-auth"
import { BANKING_SELECT, occurrenceLabel, toRecipientBanking, type RecipientBanking } from "@/lib/finance-settlement"

type PayableRow = {
  id: string
  kind: "WITHDRAWAL" | "OCCURRENCE"
  recipientType: "PARTNER" | "EXTERNAL"
  recipientId: string | null
  label: string
  amount: number
  dueDate: Date
  banking: RecipientBanking | null
}

/**
 * Contas a Pagar — compromissos com terceiros em ordem cronológica de
 * vencimento: Saques PIX de parceiros JÁ APROVADOS (vencimento = aprovação) e
 * ocorrências financeiras de favorecidos sem cadastro (ex: diarista com nome
 * livre). Pagamentos a colaboradores cadastrados NÃO entram aqui — ficam em
 * Recebíveis (ver /api/company/finance/receivables).
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    requireFinanceAccess(user)
    const companyId = user.companyId

    const [withdrawals, occurrences] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { companyId, status: "APPROVED" },
        include: { partner: { select: { id: true, name: true, partnerProfile: { select: { ...BANKING_SELECT, document: true } } } } },
      }),
      prisma.occurrence.findMany({
        where: { companyId, employeeId: null, total: { not: null }, paymentStatus: "PENDING" },
        include: { customType: { select: { name: true } } },
      }),
    ])

    const rows: PayableRow[] = [
      ...withdrawals.map((w) => ({
        id: w.id,
        kind: "WITHDRAWAL" as const,
        recipientType: "PARTNER" as const,
        recipientId: w.partnerId,
        label: "Saque PIX de parceiro",
        amount: Number(w.amount),
        dueDate: w.approvedAt ?? w.requestDate,
        banking: { ...toRecipientBanking(w.partner.name, w.partner.partnerProfile), pixKey: w.pixKey ?? w.partner.partnerProfile?.pixKey ?? null },
      })),
      ...occurrences.map((o) => ({
        id: o.id,
        kind: "OCCURRENCE" as const,
        recipientType: "EXTERNAL" as const,
        recipientId: null,
        label: occurrenceLabel(o),
        amount: Math.abs(Number(o.total)),
        dueDate: o.expectedPaymentDate ?? o.date,
        banking: { ...toRecipientBanking(o.employeeNameFreeText ?? "Favorecido sem cadastro", null), fullName: o.employeeNameFreeText ?? "Favorecido sem cadastro" },
      })),
    ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    return Response.json(rows)
  } catch (error) {
    return handleApiError(error)
  }
}
