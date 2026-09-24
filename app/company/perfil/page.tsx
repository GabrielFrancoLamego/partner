"use client"

import { useEffect, useState } from "react"
import { UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, AdminCard } from "@/components/admin/admin-ui"
import { AccountDeletionRequest } from "@/components/account-deletion-request"

type EmployeeProfile = {
  fullName: string
  cpf: string
  birthDate: string
  personalPhone: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  pixKey: string
  bankName: string
  accountType: string
  agency: string
  accountNumber: string
}

const emptyForm: EmployeeProfile = {
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

export default function CompanyProfilePage() {
  const [form, setForm] = useState<EmployeeProfile>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<Record<string, unknown>>("/api/company/my-profile")
      .then((p) => {
        setForm({
          fullName: (p.fullName as string) ?? "",
          cpf: (p.cpf as string) ?? "",
          birthDate: p.birthDate ? String(p.birthDate).slice(0, 10) : "",
          personalPhone: (p.personalPhone as string) ?? "",
          street: (p.street as string) ?? "",
          number: (p.number as string) ?? "",
          neighborhood: (p.neighborhood as string) ?? "",
          city: (p.city as string) ?? "",
          state: (p.state as string) ?? "",
          zipCode: (p.zipCode as string) ?? "",
          pixKey: (p.pixKey as string) ?? "",
          bankName: (p.bankName as string) ?? "",
          accountType: (p.accountType as string) ?? "CORRENTE",
          agency: (p.agency as string) ?? "",
          accountNumber: (p.accountNumber as string) ?? "",
        })
      })
      .finally(() => setIsLoading(false))
  }, [])

  const set = (field: keyof EmployeeProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/my-profile", { method: "PATCH", body: JSON.stringify(form) })
      setSuccess("Perfil atualizado com sucesso.")
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Preencha todos os campos obrigatórios")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Meu Perfil</h1>
        <p className="text-gray-600 mt-1 text-sm">Dados pessoais, endereço e bancários do seu cadastro.</p>
      </div>

      <AdminCard title="Dados Pessoais" icon={UserCircle2}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={form.fullName} onChange={set("fullName")} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
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

          <div className="pt-3 border-t border-gray-100 space-y-4">
            <h4 className="font-semibold text-[#3E2415] text-sm">Endereço</h4>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Rua</Label>
                <Input value={form.street} onChange={set("street")} required />
              </div>
              <div className="space-y-2">
                <Label>Nº</Label>
                <Input value={form.number} onChange={set("number")} required />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={set("neighborhood")} required />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={set("city")} required />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={form.state} onChange={set("state")} maxLength={2} required />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.zipCode} onChange={set("zipCode")} required />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-4">
            <h4 className="font-semibold text-[#3E2415] text-sm">Dados Bancários</h4>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={form.pixKey} onChange={set("pixKey")} required />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={form.agency} onChange={set("agency")} required />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={form.accountNumber} onChange={set("accountNumber")} required />
              </div>
            </div>
          </div>

          <Button type="submit" variant="brand" disabled={isSubmitting} className="min-h-11">
            {isSubmitting ? "Salvando..." : "Salvar Perfil"}
          </Button>
        </form>
      </AdminCard>

      <AccountDeletionRequest />
    </div>
  )
}
