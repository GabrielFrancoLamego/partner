"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { formatCpfCnpj, formatCep, isValidCpf, isValidCep, onlyDigits } from "@/lib/validators"

type Profile = { isProfileComplete: boolean } | null

const emptyForm = {
  fullName: "",
  cpf: "",
  birthDate: "",
  personalPhone: "",
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  pixKey: "",
  bankName: "",
  accountType: "CORRENTE",
  agency: "",
  accountNumber: "",
}

type CepLookupResponse = { address: string; neighborhood: string; city: string; state: string }

/**
 * Overlay bloqueante no primeiro acesso do Colaborador — exige o cadastro
 * completo (dados pessoais, endereço, dados bancários/PIX) antes de liberar
 * o restante da plataforma. Some assim que EmployeeProfile.isProfileComplete
 * vira true (ver PATCH /api/company/my-profile). Prioridade sobre o
 * TermAcceptanceGate — ver ordem de render em CompanyShell. Tem botão de
 * Sair para não prender o usuário caso ele não queira preencher agora.
 */
export function ProfileCompletionGate() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [cepError, setCepError] = useState("")
  const [cepLoading, setCepLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const cepDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    adminFetch<Profile>("/api/company/my-profile")
      .then(setProfile)
      .catch(() => setProfile({ isProfileComplete: true }))
  }, [])

  if (!profile || profile.isProfileComplete) return null

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const setDigitsOnly = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: onlyDigits(e.target.value) }))

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value)
    setForm((f) => ({ ...f, zipCode: formatted }))
    setCepError("")
    if (cepDebounce.current) clearTimeout(cepDebounce.current)

    const digits = onlyDigits(formatted)
    if (digits.length !== 8) return

    cepDebounce.current = setTimeout(async () => {
      setCepLoading(true)
      try {
        const result = await adminFetch<CepLookupResponse>(`/api/company/geo/cep?cep=${digits}`)
        setForm((f) => ({
          ...f,
          street: result.address || f.street,
          neighborhood: result.neighborhood || f.neighborhood,
          city: result.city || f.city,
          state: result.state || f.state,
        }))
      } catch {
        setCepError("CEP não encontrado — verifique e tente novamente")
      } finally {
        setCepLoading(false)
      }
    }, 500)
  }

  const hasPix = form.pixKey.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isValidCpf(form.cpf)) {
      setError("CPF inválido — confira os números digitados")
      return
    }
    if (!isValidCep(form.zipCode)) {
      setError("CEP inválido — confira os números digitados")
      return
    }
    if (!hasPix && (!form.bankName.trim() || !form.agency.trim() || !form.accountNumber.trim())) {
      setError("Informe a Chave PIX, ou os dados bancários completos (Banco, Agência e Conta)")
      return
    }

    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/my-profile", { method: "PATCH", body: JSON.stringify(form) })
      setProfile({ isProfileComplete: true })
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Preencha todos os campos obrigatórios")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-6 w-6 text-[#F58220]" />
              <div>
                <h2 className="text-lg font-bold text-[#3E2415]">Complete seu cadastro</h2>
                <p className="text-xs text-gray-500">Obrigatório no primeiro acesso — leva menos de 2 minutos.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
              title="Sair e entrar com outra conta"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dados pessoais</p>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={form.fullName} onChange={set("fullName")} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpfCnpj(e.target.value) }))}
                  inputMode="numeric"
                  maxLength={14}
                  required
                />
                {form.cpf.length >= 14 && !isValidCpf(form.cpf) && <p className="text-xs text-red-600">CPF inválido</p>}
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.birthDate} onChange={set("birthDate")} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone pessoal</Label>
              <Input value={form.personalPhone} onChange={set("personalPhone")} required />
            </div>

            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-100">Endereço</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.zipCode} onChange={handleCepChange} inputMode="numeric" maxLength={9} required />
                {cepLoading && <p className="text-xs text-gray-400">Buscando endereço...</p>}
                {cepError && <p className="text-xs text-red-600">{cepError}</p>}
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={form.state} onChange={set("state")} maxLength={2} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Rua</Label>
                <Input value={form.street} onChange={set("street")} required />
              </div>
              <div className="space-y-2">
                <Label>Nº</Label>
                <Input value={form.number} onChange={set("number")} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={set("neighborhood")} required />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={set("city")} required />
              </div>
            </div>

            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-100">Dados bancários</p>
            <div className="space-y-2">
              <Label>Chave PIX {!hasPix && <span className="text-gray-400 font-normal">(ou preencha os dados bancários abaixo)</span>}</Label>
              <Input value={form.pixKey} onChange={set("pixKey")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Banco {!hasPix && <span className="text-red-500">*</span>}</Label>
                <Input value={form.bankName} onChange={set("bankName")} required={!hasPix} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <Select value={form.accountType} onValueChange={(v) => setForm((f) => ({ ...f, accountType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORRENTE">Conta Corrente</SelectItem>
                    <SelectItem value="POUPANCA">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Agência {!hasPix && <span className="text-red-500">*</span>}</Label>
                <Input value={form.agency} onChange={setDigitsOnly("agency")} inputMode="numeric" required={!hasPix} />
              </div>
              <div className="space-y-2">
                <Label>Conta {!hasPix && <span className="text-red-500">*</span>}</Label>
                <Input value={form.accountNumber} onChange={setDigitsOnly("accountNumber")} inputMode="numeric" required={!hasPix} />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 py-6 text-base"
            >
              {isSubmitting ? "Salvando..." : "Concluir cadastro"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
