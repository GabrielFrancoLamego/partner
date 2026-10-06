/**
 * Soma `hours` horas ÚTEIS a `from`: só contam as horas de segunda a sexta
 * (sábado e domingo são pulados). Usado como prazo padrão de pagamento de saque
 * de parceiro — 24 horas úteis a partir da aprovação. Aprovado na sexta às 15h
 * → previsto para segunda às 15h. Função pura, usada no servidor e no navegador.
 */
export function addBusinessHours(from: Date, hours: number): Date {
  const result = new Date(from)
  let remainingMs = hours * 60 * 60 * 1000

  while (remainingMs > 0) {
    const weekday = result.getDay()
    if (weekday === 0 || weekday === 6) {
      // Fim de semana: vai para a próxima segunda-feira à meia-noite.
      result.setDate(result.getDate() + (weekday === 6 ? 2 : 1))
      result.setHours(0, 0, 0, 0)
      continue
    }
    const endOfDay = new Date(result)
    endOfDay.setHours(24, 0, 0, 0)
    const availableMs = endOfDay.getTime() - result.getTime()
    if (remainingMs <= availableMs) {
      result.setTime(result.getTime() + remainingMs)
      break
    }
    remainingMs -= availableMs
    result.setTime(endOfDay.getTime())
  }

  return result
}

export const DEFAULT_WITHDRAWAL_PAYMENT_BUSINESS_HOURS = 24
