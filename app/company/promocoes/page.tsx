"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Pencil, Power, Trash2, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"

type OfferType = "DISCOUNT" | "FREE_GIFT" | "DOUBLE_BENEFIT" | "CASH_CREDIT"

type Promotion = {
  id: string
  title: string
  description: string
  bannerUrl: string | null
  offerType: OfferType
  originalPrice: string | null
  discountedPrice: string | null
  discountPercentage: string | null
  creditAmount: string | null
  validFrom: string
  validUntil: string
  cost: string
  stock: number | null
  usedCount: number
  active: boolean
}

export const OFFER_LABELS: Record<OfferType, string> = {
  DISCOUNT: "Desconto",
  FREE_GIFT: "Brinde Gratuito",
  DOUBLE_BENEFIT: "Benefício em Dobro (Pediu 1, levou 2)",
  CASH_CREDIT: "Crédito na Comanda (R$)",
}

/** Resumo de benefício reutilizado nas telas do parceiro (Minhas Promoções/Descobrir) — mantém os 3 lugares consistentes. */
export function promotionOfferSummary(p: {
  offerType: OfferType
  discountPercentage: string | null
  originalPrice: string | null
  discountedPrice: string | null
  creditAmount: string | null
}) {
  if (p.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (p.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (p.offerType === "CASH_CREDIT") return p.creditAmount ? `R$ ${p.creditAmount} de crédito` : "Crédito na comanda"
  if (p.discountPercentage) return `${p.discountPercentage}% OFF`
  if (p.originalPrice && p.discountedPrice) return `R$ ${p.originalPrice} → R$ ${p.discountedPrice}`
  return "Desconto especial"
}

export default function CompanyPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Promotion | "new" | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Promotion[]>("/api/company/promotions").then(setPromotions).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleToggleActive = async (promotion: Promotion) => {
    await adminFetch(`/api/company/promotions/${promotion.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !promotion.active }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleDelete = async (promotion: Promotion) => {
    if (!confirm(`Excluir "${promotion.title}"?`)) return
    await adminFetch(`/api/company/promotions/${promotion.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Central de Promoções</h1>
          <p className="text-gray-600 mt-1 text-sm">Ofertas atraentes para o parceiro apresentar ao cliente indicado.</p>
        </div>
        <Button onClick={() => setEditing("new")} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nova Promoção
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : promotions.length === 0 ? (
        <EmptyState message="Nenhuma promoção cadastrada ainda." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {promotions.map((p) => (
            <div key={p.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              {p.bannerUrl && <img src={p.bannerUrl} alt={p.title} className="w-full h-32 object-cover" />}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#3E2415]">{p.title}</p>
                  <StatusBadge status={p.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(p.validFrom).toLocaleDateString("pt-BR")} – {new Date(p.validUntil).toLocaleDateString("pt-BR")}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(p)}>
                    <Power className="h-3.5 w-3.5 mr-1" /> {p.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(p)} className="text-red-600 border-red-200">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PromotionDialog
          promotion={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function PromotionDialog({ promotion, onClose, onSaved }: { promotion: Promotion | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(promotion?.title ?? "")
  const [description, setDescription] = useState(promotion?.description ?? "")
  const [bannerUrl, setBannerUrl] = useState(promotion?.bannerUrl ?? "")
  const [offerType, setOfferType] = useState<OfferType>(promotion?.offerType ?? "DISCOUNT")
  const [originalPrice, setOriginalPrice] = useState(promotion?.originalPrice ?? "")
  const [discountedPrice, setDiscountedPrice] = useState(promotion?.discountedPrice ?? "")
  const [discountPercentage, setDiscountPercentage] = useState(promotion?.discountPercentage ?? "")
  const [creditAmount, setCreditAmount] = useState(promotion?.creditAmount ?? "")
  const [validFrom, setValidFrom] = useState(promotion?.validFrom.slice(0, 10) ?? "")
  const [validUntil, setValidUntil] = useState(promotion?.validUntil.slice(0, 10) ?? "")
  const [cost, setCost] = useState(promotion?.cost ?? "")
  const [stock, setStock] = useState(promotion?.stock?.toString() ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cálculo automático: preenche o 3º campo a partir dos outros 2, sem loop —
  // cada onChange só recalcula o campo QUE NÃO foi editado agora.
  const handleOriginalPriceChange = (value: string) => {
    setOriginalPrice(value)
    const original = Number(value)
    if (!original) return
    if (discountedPrice) {
      const pct = Math.round((1 - Number(discountedPrice) / original) * 1000) / 10
      setDiscountPercentage(String(Math.max(0, pct)))
    } else if (discountPercentage) {
      const price = Math.round(original * (1 - Number(discountPercentage) / 100) * 100) / 100
      setDiscountedPrice(String(price))
    }
  }
  const handleDiscountedPriceChange = (value: string) => {
    setDiscountedPrice(value)
    const original = Number(originalPrice)
    if (!original) return
    const pct = Math.round((1 - Number(value) / original) * 1000) / 10
    setDiscountPercentage(String(Math.max(0, pct)))
  }
  const handleDiscountPercentageChange = (value: string) => {
    setDiscountPercentage(value)
    const original = Number(originalPrice)
    if (!original) return
    const price = Math.round(original * (1 - Number(value) / 100) * 100) / 100
    setDiscountedPrice(String(price))
  }

  const handleUploadPhoto = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      alert("Arquivo excede 3MB")
      return
    }
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("kind", "promotion-photo")
      body.append("file", file)
      const { url } = await adminFetch<{ url: string }>("/api/company/uploads", { method: "POST", body })
      setBannerUrl(url)
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao enviar foto")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (offerType === "CASH_CREDIT" && !creditAmount) {
      setError("Informe o valor do crédito na comanda")
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        title,
        description,
        bannerUrl: bannerUrl || null,
        offerType,
        originalPrice: offerType === "DISCOUNT" && originalPrice ? Number(originalPrice) : null,
        discountedPrice: offerType === "DISCOUNT" && discountedPrice ? Number(discountedPrice) : null,
        discountPercentage: offerType === "DISCOUNT" && discountPercentage ? Number(discountPercentage) : null,
        creditAmount: offerType === "CASH_CREDIT" && creditAmount ? Number(creditAmount) : null,
        validFrom,
        validUntil,
        cost: Number(cost),
        stock: stock ? Number(stock) : null,
      }
      if (promotion) {
        await adminFetch(`/api/company/promotions/${promotion.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      } else {
        await adminFetch("/api/company/promotions", { method: "POST", body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{promotion ? "Editar Promoção" : "Nova Promoção"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Banner de capa da promoção</Label>
            <p className="text-xs text-gray-400">Tamanho recomendado: 1200x630px | Formatos: PNG, JPG, WEBP | Peso máximo: 3MB</p>
            <div className="flex items-center gap-3">
              {bannerUrl && <img src={bannerUrl} alt="Foto" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadPhoto(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                {bannerUrl ? "Trocar" : "Enviar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de oferta</Label>
            <Select value={offerType} onValueChange={(v) => setOfferType(v as OfferType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OFFER_LABELS) as OfferType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {OFFER_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {offerType === "DISCOUNT" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-orange-50/50 border border-orange-100">
              <div className="space-y-2">
                <Label className="text-xs">Valor real (R$)</Label>
                <Input type="number" step="0.01" value={originalPrice} onChange={(e) => handleOriginalPriceChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Valor promocional (R$)</Label>
                <Input type="number" step="0.01" value={discountedPrice} onChange={(e) => handleDiscountedPriceChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">% de desconto</Label>
                <Input type="number" step="0.1" value={discountPercentage} onChange={(e) => handleDiscountPercentageChange(e.target.value)} />
              </div>
              <p className="col-span-1 sm:col-span-3 text-[11px] text-gray-500">
                Preencha 2 dos 3 campos — o terceiro é calculado automaticamente.
              </p>
            </div>
          )}

          {offerType === "CASH_CREDIT" && (
            <div className="space-y-2 p-3 rounded-lg bg-orange-50/50 border border-orange-100">
              <Label className="text-xs">Valor do crédito na comanda (R$)</Label>
              <Input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="ex: 30,00" required />
              <p className="text-[11px] text-gray-500">
                Use a descrição acima para as condições que o atendente do PDV deve validar ao escanear o QR Code do indicado (ex: "válido só no jantar", "consumo mínimo de R$100").
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Válida de</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Válida até</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Custo (R$)</Label>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Estoque (vazio = ilimitado)</Label>
              <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
