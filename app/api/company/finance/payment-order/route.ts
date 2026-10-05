import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canAccessFinanceModule } from "@/lib/permissions"

/**
 * Ordem de Pagamento — uma linha por destinatário (Parceiro ou Colaborador)
 * com algo pendente, trazendo os dados bancários/PIX prontos para digitar no
 * Internet Banking: nome, CPF/CNPJ, banco, agência, conta/chave PIX, valor
 * líquido total a pagar e os motivos/origens que compõem esse valor.
 */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    if (!canManageDailyOperations(user.role) && !canAccessFinanceModule(user)) throw new ApiError(403, "Sem permissão para esta ação")
    const companyId = user.companyId

    const [withdrawals, occurrences, goalPayouts] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { companyId, status: "PENDING" },
        include: {
          partner: {
            select: { id: true, name: true, partnerProfile: { select: { cpf: true, document: true, bankName: true, accountType: true, agency: true, accountNumber: true, pixKey: true } } },
          },
        },
      }),
      prisma.occurrence.findMany({
        where: { companyId, employeeId: { not: null }, total: { not: null }, paymentStatus: "PENDING" },
        include: {
          employee: {
            select: { id: true, name: true, employeeProfile: { select: { cpf: true, bankName: true, accountType: true, agency: true, accountNumber: true, pixKey: true } } },
          },
          customType: { select: { name: true } },
        },
      }),
      prisma.goalPayout.findMany({
        where: { companyId, status: "PENDING" },
        include: {
          employee: {
            select: { id: true, name: true, employeeProfile: { select: { cpf: true, bankName: true, accountType: true, agency: true, accountNumber: true, pixKey: true } } },
          },
          goal: { select: { name: true } },
        },
      }),
    ])

    type Row = {
      recipientType: "PARTNER" | "EMPLOYEE"
      recipientId: string
      name: string
      document: string | null
      bankName: string | null
      accountType: string | null
      agency: string | null
      accountNumber: string | null
      pixKey: string | null
      totalAmount: number
      reasons: string[]
    }
    const byRecipient = new Map<string, Row>()

    const upsert = (key: string, base: Omit<Row, "totalAmount" | "reasons">, amount: number, reason: string) => {
      const existing = byRecipient.get(key)
      if (existing) {
        existing.totalAmount += amount
        existing.reasons.push(reason)
      } else {
        byRecipient.set(key, { ...base, totalAmount: amount, reasons: [reason] })
      }
    }

    for (const w of withdrawals) {
      const p = w.partner.partnerProfile
      upsert(
        `PARTNER:${w.partnerId}`,
        {
          recipientType: "PARTNER",
          recipientId: w.partnerId,
          name: w.partner.name,
          document: p?.cpf ?? p?.document ?? null,
          bankName: p?.bankName ?? null,
          accountType: p?.accountType ?? null,
          agency: p?.agency ?? null,
          accountNumber: p?.accountNumber ?? null,
          pixKey: p?.pixKey ?? null,
        },
        Number(w.amount),
        "Saque PIX",
      )
    }

    for (const o of occurrences) {
      const e = o.employee!.employeeProfile
      const label = o.type === "CUSTOM" ? o.customType?.name ?? "Lançamento" : o.type
      upsert(
        `EMPLOYEE:${o.employeeId}`,
        {
          recipientType: "EMPLOYEE",
          recipientId: o.employeeId!,
          name: o.employee!.name,
          document: e?.cpf ?? null,
          bankName: e?.bankName ?? null,
          accountType: e?.accountType ?? null,
          agency: e?.agency ?? null,
          accountNumber: e?.accountNumber ?? null,
          pixKey: e?.pixKey ?? null,
        },
        Number(o.total),
        label,
      )
    }

    for (const p of goalPayouts) {
      const e = p.employee.employeeProfile
      upsert(
        `EMPLOYEE:${p.employeeId}`,
        {
          recipientType: "EMPLOYEE",
          recipientId: p.employeeId,
          name: p.employee.name,
          document: e?.cpf ?? null,
          bankName: e?.bankName ?? null,
          accountType: e?.accountType ?? null,
          agency: e?.agency ?? null,
          accountNumber: e?.accountNumber ?? null,
          pixKey: e?.pixKey ?? null,
        },
        Number(p.amount),
        `Meta "${p.goal.name}"`,
      )
    }

    const rows = Array.from(byRecipient.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    return Response.json(rows)
  } catch (error) {
    return handleApiError(error)
  }
}
