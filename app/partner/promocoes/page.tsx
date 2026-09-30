"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Send, Mail, MessageCircle, Compass, Download, QrCode } from "lucide-react"
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
  offerType: "DISCOUNT" | "FREE_GIFT" | "DOUBLE_BENEFIT" | "CASH_CREDIT"
  originalPrice: string | null
  discountedPrice: string | null
  discountPercentage: string | null
  creditAmount: string | null
  validUntil: string
  company: { id: string; name: string; profilePictureUrl: string | null }
}

function benefitLabel(p: Promotion) {
  if (p.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (p.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (p.offerType === "CASH_CREDIT") return p.creditAmount ? `R$ ${p.creditAmount} de crédito` : "Crédito na comanda"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Minhas Promoções</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Promoções ativas das empresas cujo Programa de Parceria você já aderiu.
          </p>
        </div>
        <Link href="/partner/descobrir">
          <Button variant="outline" size="sm">
            <Compass className="h-4 w-4 mr-1.5" /> Descobrir mais promoções
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : promotions.length === 0 ? (
        <div className="space-y-3">
          <EmptyState message="Nenhuma promoção disponível ainda — participe de um Programa de Parceria para liberar promoções." />
          <div className="flex justify-center">
            <Link href="/partner/descobrir">
              <Button variant="brand">
                <Compass className="h-4 w-4 mr-1.5" /> Descobrir Promoções
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => (
            <div key={p.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col">
              {/* Logo da empresa em destaque no topo do card */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                {p.company.profilePictureUrl ? (
                  <img
                    src={p.company.profilePictureUrl}
                    alt={p.company.name}
                    className="w-8 h-8 rounded-full object-cover border border-gray-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                )}
                <p className="text-xs font-medium text-gray-600 truncate">{p.company.name}</p>
              </div>

              {/* Banner quadrado da promoção */}
              <div className="w-full aspect-square bg-gradient-to-br from-[#F2680C]/10 to-[#FFC800]/10">
                {p.bannerUrl && <img src={p.bannerUrl} alt={p.title} className="w-full h-full object-cover" />}
              </div>

              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <p className="font-semibold text-[#3E2415] leading-tight">{p.title}</p>
                <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                <span className="inline-flex self-start items-center text-xs font-bold text-white bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full px-3 py-1 shadow-sm">
                  {benefitLabel(p)}
                </span>
                <p className="text-[10px] text-gray-400">Válida até {new Date(p.validUntil).toLocaleDateString("pt-BR")}</p>

                <div className="flex-1" />

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
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ qrDataUrl: string; emailSent: boolean; whatsappUrl: string | null } | null>(null)

  const emailError = clientEmail && !isValidEmail(clientEmail) ? "Email inválido" : ""
  const phoneError = clientPhone && !isValidPhone(clientPhone) ? "WhatsApp inválido" : ""

  const handleSend = async () => {
    setError("")
    if (!clientName.trim()) {
      setError("Informe o nome do indicado")
      return
    }
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
      const res = await adminFetch<{ qrDataUrl: string; emailSent: boolean; whatsappUrl: string | null }>(
        `/api/partner/promotions/${promotion.id}/send`,
        {
          method: "POST",
          body: JSON.stringify({
            clientName: clientName.trim(),
            clientEmail: clientEmail || undefined,
            clientPhone: clientPhone || undefined,
          }),
        },
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
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" /> QR Code único gerado para {clientName}
            </p>
            <img src={result.qrDataUrl} alt="QR Code do benefício" className="w-48 h-48 mx-auto rounded-xl border border-gray-100" />
            <a href={result.qrDataUrl} download={`qrcode-${promotion.title}.png`}>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar QR Code
              </Button>
            </a>

            {result.emailSent ? (
              <p className="text-sm text-green-700 flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" /> E-mail enviado ao cliente!
              </p>
            ) : clientEmail ? (
              <p className="text-xs text-gray-500">
                E-mail ainda não configurado neste ambiente — baixe o QR Code acima e envie manualmente.
              </p>
            ) : null}
            {result.whatsappUrl && (
              <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-green-600 hover:bg-green-700 text-white w-full">
                  <MessageCircle className="h-4 w-4 mr-2" /> Abrir no WhatsApp
                </Button>
              </a>
            )}
            {result.whatsappUrl && (
              <p className="text-[11px] text-gray-400">
                O WhatsApp abre com a mensagem pronta — anexe o QR Code baixado acima na conversa.
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <Label>Nome do indicado</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </div>
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
