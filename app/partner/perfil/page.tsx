"use client"

import { useEffect, useState } from "react"
import { UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, AdminCard } from "@/components/admin/admin-ui"
import { formatPhone, isValidPhone } from "@/lib/validators"

type PartnerProfile = {
  fullName: string | null
  whatsapp: string | null
  pixKey: string | null
  bankName: string | null
  accountType: string | null
  agency: string | null
  accountNumber: string | null
}

export default function PartnerProfilePage() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [fullName, setFullName] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountType, setAccountType] = useState("CORRENTE")
  const [agency, setAgency] = useState("")
  const [accountNumber, setAccountNumber] = useState("")

  useEffect(() => {
    adminFetch<PartnerProfile>("/api/partner/profile")
      .then((p) => {
        setProfile(p)
        setFullName(p.fullName ?? "")
        setWhatsapp(p.whatsapp ?? "")
        setPixKey(p.pixKey ?? "")
        setBankName(p.bankName ?? "")
        setAccountType(p.accountType ?? "CORRENTE")
        setAgency(p.agency ?? "")
        setAccountNumber(p.accountNumber ?? "")
      })
      .finally(() => setIsLoading(false))
  }, [])

  const whatsappError = whatsapp && !isValidPhone(whatsapp) ? "WhatsApp inválido" : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (whatsappError) {
      setError(whatsappError)
      return
    }
    setIsSubmitting(true)
    try {
      const payload = Object.fromEntries(
        Object.entries({ fullName, whatsapp, pixKey, bankName, accountType, agency, accountNumber }).filter(([, v]) => v),
      )
      await adminFetch("/api/partner/profile", { method: "PATCH", body: JSON.stringify(payload) })
      setSuccess("Perfil atualizado com sucesso.")
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || !profile) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Meu Perfil</h1>
        <p className="text-gray-600 mt-1 text-sm">Dados pessoais e bancários — usados para receber comissões e saques.</p>
      </div>

      <AdminCard title="Dados Pessoais" icon={UserCircle2}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
            {whatsappError && <p className="text-xs text-red-600">{whatsappError}</p>}
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-4">
            <div>
              <h4 className="font-semibold text-[#3E2415] text-sm">Dados Bancários</h4>
              <p className="text-xs text-gray-500">Obrigatórios antes da 1ª solicitação de saque — e usados para pagar bônus de Afiliado, se você for um.</p>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Nome do banco" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <Select value={accountType} onValueChange={setAccountType}>
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
                <Input value={agency} onChange={(e) => setAgency(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              </div>
            </div>
          </div>

          <Button type="submit" variant="brand" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar Perfil"}
          </Button>
        </form>
      </AdminCard>
    </div>
  )
}
