"use client"

import { useEffect, useState } from "react"
import { Send, Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { isValidEmail, isValidPhone, formatPhone } from "@/lib/validators"

type Promotion = {
  id: string
  title: string
  description: string
  bannerUrl: string | null
  offerType: "DISCOUNT" | "FREE_GIFT" | "DOUBLE_BENEFIT"
  originalPrice: string | null
  discountedPrice: string | null
  discountPercentage: string | null
  company: { id: string; name: string; profilePictureUrl: string | null }
}

function benefitLabel(p: Promotion) {
  if (p.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (p.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (p.discountPercentage) return `${p.discountPercentage}% OFF`
  if (p.originalPrice && p.discountedPrice) return `R$ ${p.originalPrice} → R$ ${p.discountedPrice}`
  return "Desconto especial"
}

export default function PartnerPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sending, setSending] = useState<Promotion | null>(null)

  useEffect(() => {
    adminFetch<Promotion[]>("/api/partner/promotions").then(setPromotions).finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Promoções para indicar</h1>
        <p className="text-gray-600 mt-1 text-sm">Envie um benefício direto para o cliente que você está indicando.</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : promotions.length === 0 ? (
        <EmptyState message="Nenhuma promoção ativa no momento." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {promotions.map((p) => (
            <div key={p.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              {p.bannerUrl && <img src={p.bannerUrl} alt={p.title} className="w-full h-32 object-cover" />}
              <div className="p-4 space-y-2">
                <p className="text-xs text-gray-500">{p.company.name}</p>
                <p className="font-semibold text-[#3E2415]">{p.title}</p>
                <span className="inline-block text-xs font-bold text-orange-700 bg-orange-50 rounded-full px-2.5 py-1">
                  {benefitLabel(p)}
                </span>
                <Button
                  onClick={() => setSending(p)}
                  className="w-full mt-2 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar ao Cliente
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sending && <SendBenefitDialog promotion={sending} onClose={() => setSending(null)} />}
    </div>
  )
}

function SendBenefitDialog({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ emailSent: boolean; whatsappUrl: string | null } | null>(null)

  const emailError = clientEmail && !isValidEmail(clientEmail) ? "Email inválido" : ""
  const phoneError = clientPhone && !isValidPhone(clientPhone) ? "WhatsApp inválido" : ""

  const handleSend = async () => {
    setError("")
    if (!clientEmail && !clientPhone) {
      setError("Informe email ou WhatsApp do cliente")
      return
    }
    if (emailError || phoneError) {
      setError(emailError || phoneError)
      return
    }
    setIsSubmitting(true)
    try {
      const res = await adminFetch<{ emailSent: boolean; whatsappUrl: string | null }>(
        `/api/partner/promotions/${promotion.id}/send`,
        { method: "POST", body: JSON.stringify({ clientEmail: clientEmail || undefined, clientPhone: clientPhone || undefined }) },
      )
      setResult(res)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao enviar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar "{promotion.title}" ao cliente</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-center py-4">
            {result.emailSent ? (
              <p className="text-sm text-green-700 flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" /> E-mail enviado ao cliente!
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                E-mail ainda não configurado neste ambiente — use o WhatsApp abaixo para enviar direto.
              </p>
            )}
            {result.whatsappUrl && (
              <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-green-600 hover:bg-green-700 text-white w-full">
                  <MessageCircle className="h-4 w-4 mr-2" /> Abrir no WhatsApp
                </Button>
              </a>
            )}
            <Button variant="outline" className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <Label>Email do cliente</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label>WhatsApp do cliente</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
              >
                Enviar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
