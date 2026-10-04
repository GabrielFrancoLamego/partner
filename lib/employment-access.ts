import "server-only"
import { prisma } from "./prisma"
import { logAudit } from "./audit"
import { notifyUser } from "./notifications"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Regra do TEMPORARIO: ao vencer `contractEndDate` sem nenhuma pendência
 * financeira (Occurrence PENDING com valor ou GoalPayout PENDING), o acesso é
 * bloqueado automaticamente (User.status = INACTIVE) — só a Gerente/Master
 * desbloqueia manualmente, ao convocar para um novo turno/contrato (ver
 * app/api/company/employees/[id]/route.ts PATCH status).
 *
 * Chamada "on demand" (não por cron): no login (app/api/auth/login) e em toda
 * chamada autenticada de staff (lib/api-auth.ts#requireCompanyStaff) — mesmo
 * padrão "ensure on read" usado por lib/checklist-engine.ts.
 */
export async function enforceEmploymentAccessRules(user: {
  id: string
  companyId: string | null
  role: string
  status: string
  employeeProfile: { employmentType: string; contractEndDate: Date | null } | null
}): Promise<boolean> {
  if (user.role !== "EMPLOYEE" || user.status !== "ACTIVE" || !user.employeeProfile || !user.companyId) return false
  if (user.employeeProfile.employmentType !== "TEMPORARIO") return false
  if (!user.employeeProfile.contractEndDate) return false
  if (startOfDay(user.employeeProfile.contractEndDate) > startOfDay(new Date())) return false

  const [pendingOccurrence, pendingGoalPayout] = await Promise.all([
    prisma.occurrence.findFirst({ where: { companyId: user.companyId, employeeId: user.id, paymentStatus: "PENDING", total: { not: null } } }),
    prisma.goalPayout.findFirst({ where: { companyId: user.companyId, employeeId: user.id, status: "PENDING" } }),
  ])
  if (pendingOccurrence || pendingGoalPayout) return false

  await prisma.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } })
  await logAudit({
    userId: user.id,
    companyId: user.companyId,
    action: "AUTO_BLOCK",
    entity: "User",
    entityId: user.id,
    details: { reason: "Contrato TEMPORARIO vencido sem pendências financeiras" },
  })
  await notifyUser({
    userId: user.id,
    type: "GENERIC",
    title: "Acesso bloqueado — contrato encerrado",
    message: "Seu contrato temporário chegou ao fim e não há pendências financeiras. O acesso será liberado pela Gerência caso você seja convocado novamente.",
  }).catch(() => {})

  return true
}

/**
 * Regra do DIARISTA: ao confirmar o pagamento de uma diária (Occurrence
 * type=DIARIA marcada como PAID no Financeiro), o acesso é bloqueado
 * automaticamente — só a Gerente/Master desbloqueia ao convocar o diarista
 * para um novo turno.
 */
export async function maybeBlockDiaristaAfterPayment(companyId: string, employeeId: string) {
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, status: true, employeeProfile: { select: { employmentType: true } } },
  })
  if (!employee || employee.status !== "ACTIVE") return
  if (employee.employeeProfile?.employmentType !== "DIARISTA") return

  await prisma.user.update({ where: { id: employee.id }, data: { status: "INACTIVE" } })
  await logAudit({
    userId: employee.id,
    companyId,
    action: "AUTO_BLOCK",
    entity: "User",
    entityId: employee.id,
    details: { reason: "Diária paga — acesso de diarista bloqueado até nova convocação" },
  })
  await notifyUser({
    userId: employee.id,
    type: "GENERIC",
    title: "Acesso bloqueado — diária paga",
    message: "O pagamento da sua diária foi confirmado. O acesso é liberado pela Gerência quando você for convocado para o próximo turno.",
  }).catch(() => {})
}
