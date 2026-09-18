"use client"

import { useEffect, useState } from "react"
import { UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

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

/**
 * Overlay bloqueante no primeiro acesso do Colaborador — exige o cadastro
 * completo (dados pessoais, endereço, dados bancários/PIX) antes de liberar
 * o restante da plataforma. Some assim que EmployeeProfile.isProfileComplete
 * vira true (ver PATCH /api/company/my-profile). Prioridade sobre o
 * TermAcceptanceGate — ver ordem de render em CompanyShell.
 */
export function ProfileCompletionGate() {
  const [profile, setProfile] = useState<Profile>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<Profile>("/api/company/my-profile")
      .then(setProfile)
      .catch(() => setProfile({ isProfileComplete: true }))
  }, [])

  if (!profile || profile.isProfileComplete) return null

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
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
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-6 w-6 text-[#F58220]" />
            <div>
              <h2 className="text-lg font-bold text-[#3E2415]">Complete seu cadastro</h2>
              <p className="text-xs text-gray-500">Obrigatório no primeiro acesso — leva menos de 2 minutos.</p>
            </div>
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
                <Input value={form.cpf} onChange={set("cpf")} required />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={form.state} onChange={set("state")} maxLength={2} required />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.zipCode} onChange={set("zipCode")} required />
              </div>
            </div>

            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-100">Dados bancários</p>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={form.pixKey} onChange={set("pixKey")} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={form.bankName} onChange={set("bankName")} required />
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
                <Label>Agência</Label>
                <Input value={form.agency} onChange={set("agency")} required />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={form.accountNumber} onChange={set("accountNumber")} required />
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
