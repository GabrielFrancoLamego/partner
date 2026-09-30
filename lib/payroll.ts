import "server-only"

/**
 * Conta quantos dias do mês de `referenceDate` são dias de trabalho para um
 * colaborador — todo dia da semana, exceto `weeklyDayOff` (0=domingo..6=sábado).
 * Sem folga fixa cadastrada, assume só domingo como folga (padrão comum do
 * setor de hospitalidade/alimentação, onde a maioria destas empresas opera).
 * Usado como base para o valor da hora (ver computeOvertimePreview).
 */
export function computeWorkingDaysInMonth(weeklyDayOff: number | null, referenceDate = new Date()): number {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayOff = weeklyDayOff ?? 0

  let workingDays = 0
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() !== dayOff) workingDays++
  }
  return workingDays
}

export type EmployeeScheduleForPayroll = {
  workStartTime: string | null
  workEndTime: string | null
  dailyBreakAllowanceMinutes: number
  weeklyDayOff: number | null
  monthlySalary: number | null
}

export type OvertimePreview = {
  dailyScheduledMinutes: number
  workingDaysInMonth: number
  monthlyMinutes: number
  hourlyRate: number
  hours: number
  baseAmount: number
  bonus50: number
  totalAmount: number
}

/**
 * Pagamento de Horas Extras — valor da hora calculado A PARTIR DO HORÁRIO E
 * SALÁRIO DE CADA COLABORADOR (não uma base fixa igual pra todo mundo):
 *   hora = salário mensal / (horas diárias cadastradas × dias úteis do mês)
 *   valor = hora × horas extras × 1,5 (os 50% de adicional)
 * Lançado como Occurrence.type = HORA_EXTRA (ver app/api/company/occurrences).
 */
export function computeOvertimePreview(schedule: EmployeeScheduleForPayroll, hours: number, referenceDate = new Date()): OvertimePreview {
  if (!schedule.workStartTime || !schedule.workEndTime) {
    throw new Error("Colaborador sem horário de trabalho cadastrado — não é possível calcular o valor da hora")
  }
  if (!schedule.monthlySalary || schedule.monthlySalary <= 0) {
    throw new Error("Colaborador sem salário mensal cadastrado — não é possível calcular o valor da hora")
  }
  if (!hours || hours <= 0) {
    throw new Error("Informe a quantidade de horas extras")
  }

  const [sh, sm] = schedule.workStartTime.split(":").map(Number)
  const [eh, em] = schedule.workEndTime.split(":").map(Number)
  const dailyScheduledMinutes = Math.max(60, eh * 60 + em - (sh * 60 + sm) - (schedule.dailyBreakAllowanceMinutes ?? 0))

  const workingDaysInMonth = computeWorkingDaysInMonth(schedule.weeklyDayOff, referenceDate)
  const monthlyMinutes = dailyScheduledMinutes * workingDaysInMonth
  const hourlyRate = schedule.monthlySalary / (monthlyMinutes / 60)

  const baseAmount = Math.round(hourlyRate * hours * 100) / 100
  const bonus50 = Math.round(baseAmount * 0.5 * 100) / 100
  const totalAmount = Math.round((baseAmount + bonus50) * 100) / 100

  return { dailyScheduledMinutes, workingDaysInMonth, monthlyMinutes, hourlyRate: Math.round(hourlyRate * 100) / 100, hours, baseAmount, bonus50, totalAmount }
}
