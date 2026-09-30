import type { TimeclockAdjustmentKind } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { awardXp } from "@/lib/gamification"
import { notifyUser } from "@/lib/notifications"
import { logAudit } from "@/lib/audit"
import { computePendingTimeclockAdjustments } from "@/lib/timeclock-adjustments"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const KINDS: TimeclockAdjustmentKind[] = ["LATE_CHECKIN", "CHECKOUT_VARIANCE", "BREAK_OVERAGE"]

/**
 * Passo 0 do Fechamento — a Gerente/Master confirma (ou perdoa) UMA variação
 * de ponto de UM colaborador por vez. Recalcula a variação no servidor (nunca
 * confia em número vindo do cliente) para garantir que o que for aplicado é
 * exatamente o que o relógio apurou (ver lib/timeclock-adjustments.ts).
 */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const body = await request.json()
    const { employeeId, kind, apply, justification, date: dateRaw } = body as {
      employeeId: string
      kind: TimeclockAdjustmentKind
      apply: boolean
      justification?: string
      date?: string
    }

    if (!employeeId || !kind || !KINDS.includes(kind)) throw new ApiError(400, "Dados inválidos")
    if (typeof apply !== "boolean") throw new ApiError(400, "Informe se o ajuste deve ser aplicado")

    const date = startOfDay(dateRaw ? new Date(dateRaw) : new Date())

    const pending = await computePendingTimeclockAdjustments(companyId, date)
    const item = pending.find((p) => p.employeeId === employeeId && p.kind === kind)
    if (!item) throw new ApiError(404, "Esta variação já foi revisada ou não existe mais para este dia")

    if (apply && item.isNegativeForEmployee && !justification?.trim()) {
      throw new ApiError(400, "Justifique o desconto antes de aplicar")
    }

    await prisma.$transaction(async (tx) => {
      await tx.timeclockAdjustmentReview.create({
        data: {
          companyId,
          employeeId,
          date,
          kind,
          computedMinutes: item.computedMinutes,
          computedPoints: item.computedPoints,
          applied: apply,
          justification: justification?.trim() || null,
          reviewedById: user.id,
        },
      })

      if (apply) {
        if (item.computedMinutes !== 0) {
          await tx.employeeProfile.update({
            where: { userId: employeeId },
            data: { bankOfHoursMinutes: { increment: item.computedMinutes } },
          })
        }
        if (item.computedPoints !== 0) {
          await awardXp(
            { companyId, employeeId, reason: "ATTENDANCE", points: item.computedPoints, note: item.label },
            tx,
          )
        }
      }
    })

    await logAudit({
      userId: user.id,
      companyId,
      action: apply ? "APPLY" : "FORGIVE",
      entity: "TimeclockAdjustmentReview",
      entityId: `${employeeId}:${date.toISOString()}:${kind}`,
      details: { kind, computedMinutes: item.computedMinutes, computedPoints: item.computedPoints, justification },
    })

    const parts: string[] = [item.label]
    if (apply) {
      if (item.computedMinutes !== 0) parts.push(`${item.computedMinutes > 0 ? "+" : ""}${item.computedMinutes}min no banco de horas`)
      if (item.computedPoints !== 0) parts.push(`${item.computedPoints > 0 ? "+" : ""}${item.computedPoints} pontos`)
      if (justification?.trim()) parts.push(`Motivo: ${justification.trim()}`)
    }
    await notifyUser({
      userId: employeeId,
      type: "GENERIC",
      title: apply ? "Variação de ponto confirmada" : "Variação de ponto perdoada",
      message: apply ? parts.join(" — ") : `${item.label} — a Gerência decidiu não aplicar nenhum desconto.`,
      linkUrl: "/company/ponto",
    }).catch(() => {})

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
