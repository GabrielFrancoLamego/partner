"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { formatCpfCnpj, isValidCpfOrCnpj, onlyDigits } from "@/lib/validators"

/**
 * Etapa 2 do cadastro do Parceiro — CPF + Chave PIX (ou dados bancários
 * completos), exigidos só na primeira vez que ele tenta Aderir a um Programa
 * ou pedir um saque (ver lib/partner-adesao.ts, resposta 428 das APIs).
 * Ao salvar, chama `onCompleted` para o chamador repetir a ação original.
 */
export function AdesaoGateDialog({ onClose, onCompleted }: { onClose: () => void; onCompleted: () => void }) {
  const [cpf, setCpf] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [bankName, setBankName] = useState("")
  const [agency, setAgency] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasPix = pixKey.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isValidCpfOrCnpj(cpf)) {
      setError("CPF inválido — confira os números digitados")
      return
    }
    if (!hasPix && (!bankName.trim() || !agency.trim() || !accountNumber.trim())) {
      setError("Informe a Chave PIX, ou os dados bancários completos (Banco, Agência e Conta)")
      return
    }

    setIsSubmitting(true)
    try {
      await adminFetch("/api/partner/profile", {
        method: "PATCH",
        body: JSON.stringify({ cpf, pixKey: pixKey || undefined, bankName: bankName || undefined, agency: agency || undefined, accountNumber: accountNumber || undefined }),
      })
      onCompleted()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#F58220]" /> Complete seu cadastro
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">
          Para aderir a um programa ou solicitar saques, precisamos do seu CPF e de uma forma de pagamento.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={cpf} onChange={(e) => setCpf(formatCpfCnpj(e.target.value))} inputMode="numeric" maxLength={14} required />
          </div>
          <div className="space-y-2">
            <Label>Chave PIX {!hasPix && <span className="text-gray-400 font-normal">(ou preencha os dados bancários abaixo)</span>}</Label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Banco {!hasPix && <span className="text-red-500">*</span>}</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} required={!hasPix} />
            </div>
            <div className="space-y-2">
              <Label>Agência {!hasPix && <span className="text-red-500">*</span>}</Label>
              <Input value={agency} onChange={(e) => setAgency(onlyDigits(e.target.value))} inputMode="numeric" required={!hasPix} />
            </div>
            <div className="space-y-2">
              <Label>Conta {!hasPix && <span className="text-red-500">*</span>}</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(onlyDigits(e.target.value))} inputMode="numeric" required={!hasPix} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              {isSubmitting ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
