/**
 * Validação de formato de documentos/contato usados nos cadastros do Admin
 * (empresa, master, parceiro/afiliado). Funções puras — sem dependência de
 * servidor — para poderem rodar tanto no formulário (feedback em tempo real)
 * quanto na rota de API (validação de verdade, nunca só no client).
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Aceita fixo (10) ou celular (11) com DDD, com ou sem máscara. */
export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value)
  return digits.length === 10 || digits.length === 11
}

function cpfChecksum(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
}

function cnpjChecksum(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * weights[i]
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13])
}

export function isValidCpf(value: string): boolean {
  return cpfChecksum(onlyDigits(value))
}

export function isValidCnpj(value: string): boolean {
  return cnpjChecksum(onlyDigits(value))
}

/** Valida CPF (11 dígitos) ou CNPJ (14 dígitos) conforme o tamanho informado. */
export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value)
  if (digits.length === 11) return cpfChecksum(digits)
  if (digits.length === 14) return cnpjChecksum(digits)
  return false
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8
}

export function formatCpf(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

export function formatCnpj(digits: string): string {
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
}

/** Formata progressivamente enquanto o usuário digita CPF ou CNPJ (decide pelo tamanho). */
export function formatCpfCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

export function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_m, a, b, c) => (c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : a))
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_m, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`))
}
