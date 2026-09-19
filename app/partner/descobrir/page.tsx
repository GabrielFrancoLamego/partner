"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, X, MapPin, Send, Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { StarRatingDisplay } from "@/components/partner/star-rating"
import { isValidEmail, isValidPhone, formatPhone } from "@/lib/validators"

type OfferType = "DISCOUNT" | "FREE_GIFT" | "DOUBLE_BENEFIT" | "CASH_CREDIT"
type MembershipStatus = "ACTIVE" | "LEFT_BY_PARTNER" | "TERMINATED_INACTIVITY" | "PROGRAM_ENDED" | null

type DiscoverPromotion = {
  id: string
  title: string
  description: string
  bannerUrl: string | null
  offerType: OfferType
  originalPrice: string | null
  discountedPrice: string | null
  discountPercentage: string | null
  creditAmount: string | null
  company: {
    id: string
    name: string
    city: string | null
    segment: string | null
    avgRating: string | null
    ratingCount: number
    profilePictureUrl: string | null
  }
  programId: string | null
  programStatus: "ACTIVE" | "PAUSED_FOR_NEW_MEMBERS" | "ARCHIVED" | null
  membershipStatus: MembershipStatus
}

const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  DISCOUNT: "Desconto (%/R$)",
  FREE_GIFT: "Brinde",
  DOUBLE_BENEFIT: "Dobro",
  CASH_CREDIT: "Crédito (R$)",
}

function benefitLabel(p: DiscoverPromotion) {
  if (p.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (p.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (p.offerType === "CASH_CREDIT") return p.creditAmount ? `R$ ${p.creditAmount} de crédito` : "Crédito na comanda"
  if (p.discountPercentage) return `${p.discountPercentage}% OFF`
  if (p.originalPrice && p.discountedPrice) return `R$ ${p.originalPrice} → R$ ${p.discountedPrice}`
  return "Desconto especial"
}

export default function PartnerDiscoverPromotionsPage() {
  const [promotions, setPromotions] = useState<DiscoverPromotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [offerTypeFilter, setOfferTypeFilter] = useState<OfferType | null>(null)
  const [joining, setJoining] = useState<string | null>(null)
  const [sending, setSending] = useState<DiscoverPromotion | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<DiscoverPromotion[]>("/api/partner/discover-promotions")
      .then(setPromotions)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const cities = useMemo(
    () => Array.from(new Set(promotions.map((p) => p.company.city).filter((c): c is string => Boolean(c)))).sort(),
    [promotions],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return promotions.filter((p) => {
      if (q) {
        const haystack = `${p.company.name} ${p.company.segment ?? ""} ${p.title}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (cityFilter && p.company.city !== cityFilter) return false
      if (offerTypeFilter && p.offerType !== offerTypeFilter) return false
      return true
    })
  }, [promotions, query, cityFilter, offerTypeFilter])

  const hasFilter = Boolean(query || cityFilter || offerTypeFilter)
  const clearFilters = () => {
    setQuery("")
    setCityFilter(null)
    setOfferTypeFilter(null)
  }

  const handleJoin = async (p: DiscoverPromotion) => {
    if (!p.programId) return
    setJoining(p.id)
    try {
      await adminFetch(`/api/partner/programs/${p.programId}/join`, { method: "POST" })
      reload()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao aderir ao programa")
    } finally {
      setJoining(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Descobrir Promoções</h1>
        <p className="text-gray-600 mt-1 text-sm">Vitrine de promoções de todas as empresas da plataforma.</p>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por empresa, categoria ou palavra-chave..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={cityFilter ?? "all"} onValueChange={(v) => setCityFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
              <SelectValue placeholder="Localidade/Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={offerTypeFilter ?? "all"} onValueChange={(v) => setOfferTypeFilter(v === "all" ? null : (v as OfferType))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
              <SelectValue placeholder="Tipo de promoção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(OFFER_TYPE_LABELS) as OfferType[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {OFFER_TYPE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-0.5 text-xs font-medium text-orange-800 underline underline-offset-2 cursor-pointer"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState message={hasFilter ? "Nenhuma promoção nesses filtros." : "Nenhuma promoção disponível no momento."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const isMember = p.membershipStatus === "ACTIVE"
            return (
              <div key={p.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col">
                {p.bannerUrl ? (
                  <img src={p.bannerUrl} alt={p.title} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-[#F2680C]/10 to-[#FFC800]/10" />
                )}
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <p className="text-xs text-gray-500">{p.company.name}</p>
                  {p.company.city && (
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.company.city}
                      {p.company.segment && ` · ${p.company.segment}`}
                    </p>
                  )}
                  <StarRatingDisplay value={p.company.avgRating} count={p.company.ratingCount} />
                  <p className="font-semibold text-[#3E2415]">{p.title}</p>
                  <span className="inline-block w-fit text-xs font-bold text-orange-700 bg-orange-50 rounded-full px-2.5 py-1">
                    {benefitLabel(p)}
                  </span>

                  <div className="flex-1" />

                  {isMember ? (
                    <Button onClick={() => setSending(p)} className="w-full mt-2 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                      <Send className="h-4 w-4 mr-2" />
                      Enviar ao Cliente
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      disabled={joining === p.id || p.programStatus !== "ACTIVE"}
                      onClick={() => handleJoin(p)}
                    >
                      {p.programStatus !== "ACTIVE" ? "Fechado p/ novas adesões" : joining === p.id ? "Aderindo..." : "Aderir ao Programa para ofertar"}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sending && <SendBenefitDialog promotion={sending} onClose={() => setSending(null)} />}
    </div>
  )
}

function SendBenefitDialog({ promotion, onClose }: { promotion: DiscoverPromotion; onClose: () => void }) {
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
