"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhone, isValidEmail, isValidPhone } from "@/lib/validators"

export function CompanyJoinForm({
  companyName,
  logoUrl,
  slug,
  linkToken,
}: {
  companyName: string
  logoUrl: string | null
  slug: string
  linkToken?: string | null
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [document, setDocument] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [linkExpired, setLinkExpired] = useState(false)
  const [isCheckingLink, setIsCheckingLink] = useState(!!linkToken)

  useEffect(() => {
    if (!linkToken) return
    fetch(`/api/public/links/${linkToken}`)
      .then((r) => r.json())
      .then((data) => setLinkExpired(!data.valid))
      .catch(() => setLinkExpired(true))
      .finally(() => setIsCheckingLink(false))
  }, [linkToken])

  const emailError = email && !isValidEmail(email) ? "Email inválido" : ""
  const phoneError = phone && !isValidPhone(phone) ? "Telefone inválido" : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (emailError || phoneError) {
      setError(emailError || phoneError)
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/public/company-join/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, document: document || undefined, token: linkToken ?? undefined }),
      })
      const data = await response.json().catch(() => null)
      if (response.status === 410) {
        setLinkExpired(true)
        return
      }
      if (!response.ok) throw new Error(data?.error ?? "Erro ao enviar cadastro")
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar cadastro")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCheckingLink) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2]" />
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
          <Link2Off className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-[#3E2415]">Link expirado</h1>
          <p className="text-sm text-gray-600 mt-2">Este link de cadastro não está mais ativo ou venceu.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4 py-10">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="flex flex-col items-center text-center mb-5">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-14 object-contain mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] mb-3" />
          )}
          <h1 className="text-lg font-bold text-[#3E2415]">Trabalhe na {companyName}</h1>
          <p className="text-sm text-gray-500 mt-1">Preencha seus dados para solicitar seu cadastro.</p>
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
              <Label>CPF (opcional)</Label>
              <Input value={document} onChange={(e) => setDocument(e.target.value)} />
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
