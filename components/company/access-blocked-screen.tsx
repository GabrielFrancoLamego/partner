"use client"

import { useState } from "react"
import { AlertTriangle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { CompanyAccessState } from "@/lib/company-access"

const REASON_COPY: Record<string, { title: string; description: string }> = {
  OVERDUE: {
    title: "Acesso suspenso por pendência financeira",
    description:
      "O período de carência de 15 dias para regularização já passou. Regularize a pendência para liberar o acesso novamente.",
  },
  BLOCKED: {
    title: "Acesso bloqueado pela plataforma",
    description: "Sua empresa foi bloqueada pelo administrador da Tribuss. Entre em contato para mais informações.",
  },
  INACTIVE: {
    title: "Empresa inativa",
    description: "O acesso desta empresa está inativo no momento. Fale com o administrador da plataforma.",
  },
  ARCHIVED: {
    title: "Empresa arquivada",
    description: "Esta empresa foi arquivada e não está mais acessível. Fale com o administrador da plataforma.",
  },
}

export function AccessBlockedScreen({
  reason,
  statusReason,
}: {
  reason: Extract<CompanyAccessState, { kind: "BLOCKED" }>["reason"]
  statusReason: string | null
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const copy = REASON_COPY[reason]

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const handleRegularize = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/company/billing/regularize", { method: "POST" })
      if (response.ok) setSent(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        <h1 className="text-lg font-bold text-[#3E2415] mb-2">{copy.title}</h1>
        <p className="text-sm text-gray-600 mb-1">{copy.description}</p>
        {statusReason && <p className="text-xs text-gray-400 italic mb-4">"{statusReason}"</p>}

        {reason === "OVERDUE" && (
          <div className="mt-4">
            {sent ? (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                Solicitação enviada! Nosso financeiro vai entrar em contato em breve.
              </p>
            ) : (
              <Button
                onClick={handleRegularize}
                disabled={isSubmitting}
                className="w-full h-11 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white font-medium rounded-xl shadow-md disabled:opacity-70"
              >
                {isSubmitting ? "Enviando..." : "Regularizar Pendência"}
              </Button>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm text-gray-500 hover:text-[#3E2415] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  )
}
