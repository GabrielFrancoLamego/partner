"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCpfCnpj, formatPhone, isValidCpfOrCnpj, isValidEmail, isValidPhone } from "@/lib/validators"

export function PartnerJoinForm({ refCode }: { refCode: string | null }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [document, setDocument] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const emailError = email && !isValidEmail(email) ? "Email inválido" : ""
  const phoneError = phone && !isValidPhone(phone) ? "Telefone inválido" : ""
  const documentError = document && !isValidCpfOrCnpj(document) ? "CPF/CNPJ inválido" : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (emailError || phoneError || documentError) {
      setError(emailError || phoneError || documentError)
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/public/partner-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, document, ref: refCode ?? undefined }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Erro ao enviar cadastro")
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar cadastro")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4 py-10">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="h-12 object-contain mb-3" />
          <h1 className="text-lg font-bold text-[#3E2415]">Seja um Parceiro Tribuss</h1>
          <p className="text-sm text-gray-500 mt-1">Indique clientes e receba comissão via PIX.</p>
          {refCode && <p className="text-xs text-green-700 bg-green-50 rounded-full px-3 py-1 mt-2">Indicado por afiliado</p>}
        </div>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#3E2415]">Cadastro enviado!</p>
            <p className="text-xs text-gray-500 mt-1">
              Sua solicitação está pendente de aprovação. Você será avisado assim que seu acesso for liberado.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" required />
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
            </div>
            <div className="space-y-2">
              <Label>CPF ou CNPJ</Label>
              <Input value={document} onChange={(e) => setDocument(formatCpfCnpj(e.target.value))} required />
              {documentError && <p className="text-xs text-red-600">{documentError}</p>}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
            >
              {isSubmitting ? "Enviando..." : "Enviar cadastro"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
