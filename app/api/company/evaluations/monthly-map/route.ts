import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"

/**
 * Mapa Mensal de Performance — matriz Colaborador x Dia com as notas diárias
 * lançadas pela Gerente no Fechamento de Caixa (ver DailyEvaluation e
 * app/api/company/evaluations). Usado por /company/mapa-pontos para o Master
 * analisar o histórico do mês de uma vez.
 */
export async function GET(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) return Response.json({ error: "Mês inválido" }, { status: 400 })

    const [year, monthNum] = month.split("-").map(Number)
    const start = new Date(year, monthNum - 1, 1)
    const end = new Date(year, monthNum, 1)
    const daysInMonth = new Date(year, monthNum, 0).getDate()

    const [employees, evaluations] = await Promise.all([
      prisma.user.findMany({
        where: { companyId, role: "EMPLOYEE", status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.dailyEvaluation.findMany({
        where: { companyId, date: { gte: start, lt: end } },
        select: { employeeId: true, date: true, score: true, justification: true },
      }),
    ])

    const byEmployee = new Map<string, Map<number, { score: number; justification: string | null }>>()
    for (const ev of evaluations) {
      const day = ev.date.getDate()
      if (!byEmployee.has(ev.employeeId)) byEmployee.set(ev.employeeId, new Map())
      byEmployee.get(ev.employeeId)!.set(day, { score: Number(ev.score), justification: ev.justification })
    }

    const rows = employees.map((e) => {
      const days = byEmployee.get(e.id) ?? new Map()
      const scores = Array.from({ length: daysInMonth }, (_, i) => days.get(i + 1) ?? null)
      const evaluatedScores = scores.filter((s): s is { score: number; justification: string | null } => s !== null)
      const total = evaluatedScores.reduce((sum, s) => sum + s.score, 0)
      const average = evaluatedScores.length > 0 ? total / evaluatedScores.length : null
      return { employeeId: e.id, employeeName: e.name, days: scores, total, average, evaluatedCount: evaluatedScores.length }
    })

    return Response.json({ month, daysInMonth, rows })
  } catch (error) {
    return handleApiError(error)
  }
}
