"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhone, isValidEmail, isValidPhone } from "@/lib/validators"

type LinkInfo = { valid: boolean; plan: string | null }

export function CompanySignupForm({ token }: { token: string }) {
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [desiredSlug, setDesiredSlug] = useState("")
  const [masterName, setMasterName] = useState("")
  const [masterEmail, setMasterEmail] = useState("")
  const [masterPhone, setMasterPhone] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/public/links/${token}`)
      .then((r) => r.json())
      .then((data) => setLinkInfo({ valid: data.valid && data.type === "COMPANY_SIGNUP", plan: data.plan }))
      .catch(() => setLinkInfo({ valid: false, plan: null }))
  }, [token])

  const emailError = masterEmail && !isValidEmail(masterEmail) ? "Email inválido" : ""
  const phoneError = masterPhone && !isValidPhone(masterPhone) ? "WhatsApp inválido" : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (emailError || phoneError) {
      setError(emailError || phoneError)
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/public/company-signup/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          desiredSlug: desiredSlug.toLowerCase().trim().replace(/\s+/g, "-"),
          masterName,
          masterEmail,
          masterPhone,
        }),
      })
      const data = await response.json().catch(() => null)
      if (response.status === 410) {
        setLinkInfo({ valid: false, plan: null })
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

  if (linkInfo === null) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2]" />
  }

  if (!linkInfo.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
          <Link2Off className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-[#3E2415]">Link expirado</h1>
          <p className="text-sm text-gray-600 mt-2">Este link de cadastro de empresa não está mais ativo ou venceu.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4 py-10">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="flex flex-col items-center text-center mb-5">
          <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="h-12 object-contain mb-3" />
          <h1 className="text-lg font-bold text-[#3E2415]">Cadastre sua empresa na Tribuss</h1>
          <p className="text-sm text-gray-500 mt-1">Sua solicitação passa por uma aprovação rápida do Admin.</p>
        </div>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#3E2415]">Cadastro enviado!</p>
            <p className="text-xs text-gray-500 mt-1">
              Assim que aprovado, o responsável cadastrado recebe o link de ativação de acesso.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Slug desejado</Label>
              <Input value={desiredSlug} onChange={(e) => setDesiredSlug(e.target.value)} placeholder="minha-empresa" required />
            </div>
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <Label>Nome do responsável (Master)</Label>
              <Input value={masterName} onChange={(e) => setMasterName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email do responsável</Label>
              <Input type="email" value={masterEmail} onChange={(e) => setMasterEmail(e.target.value)} required />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label>WhatsApp do responsável</Label>
              <Input value={masterPhone} onChange={(e) => setMasterPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" required />
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
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
