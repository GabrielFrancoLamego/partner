"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

/**
 * Segundo fator do login — só aparece para contas com 2FA ativo (ver
 * app/partner/layout.tsx, que redireciona pra cá quando a sessão Supabase já
 * existe mas o cookie de 2FA verificado ainda não). Depois de confirmado,
 * volta para "/", que roteia pelo Role normalmente.
 */
export default function Verify2FAPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (code.length !== 6) {
      setError("Digite os 6 dígitos do código")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error ?? "Código inválido")
        return
      }
      router.push("/")
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center">
        <ShieldCheck className="h-10 w-10 text-[#F58220] mx-auto mb-3" />
        <h1 className="text-lg font-bold text-[#3E2415] mb-1">Verificação em duas etapas</h1>
        <p className="text-sm text-gray-500 mb-6">Digite o código de 6 dígitos do seu app autenticador.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white py-6"
          >
            {isSubmitting ? "Verificando..." : "Confirmar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
