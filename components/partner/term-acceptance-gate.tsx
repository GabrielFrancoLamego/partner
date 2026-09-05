"use client"

import { useEffect, useState } from "react"
import { FileText, ExternalLink, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-api-client"

type TermStatus = {
  program: { id: string; name: string; description: string | null; imageUrl: string | null; pdfUrl: string | null; termsContent: string | null } | null
  accepted: boolean
}

/** Overlay bloqueante no primeiro acesso do parceiro — aceite do Programa de Parceiros. */
export function PartnerTermAcceptanceGate() {
  const [status, setStatus] = useState<TermStatus | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<TermStatus>("/api/partner/term-acceptance")
      .then(setStatus)
      .catch(() => setStatus({ program: null, accepted: true }))
  }, [])

  if (!status || status.accepted || !status.program) return null
  const { program } = status

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      await adminFetch("/api/partner/term-acceptance", { method: "POST", body: JSON.stringify({ programId: program.id }) })
      setStatus({ ...status, accepted: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {program.imageUrl && <img src={program.imageUrl} alt={program.name} className="w-full h-40 object-cover" />}
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-[#3E2415]">{program.name}</h2>
            {program.description && <p className="text-sm text-gray-600 mt-1">{program.description}</p>}
          </div>

          {program.termsContent && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 max-h-56 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{program.termsContent}</p>
            </div>
          )}

          {program.pdfUrl && (
            <a
              href={program.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-[#F58220] hover:underline w-fit"
            >
              <FileText className="h-4 w-4" /> Ver regulamento completo (PDF) <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 py-6 text-base"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Li e aceito os termos do Programa de Parceiros
          </Button>
        </div>
      </div>
    </div>
  )
}
