"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Power, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { FileUploadField } from "@/components/shared/file-upload-field"
import { IconActionButton } from "@/components/ui/icon-action-button"

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
  company: { id: string; name: string }
  units: { unit: { id: string; name: string } }[]
}

const OFFER_LABELS: Record<OfferType, string> = {
  DISCOUNT: "Desconto",
  FREE_GIFT: "Brinde Gratuito",
  DOUBLE_BENEFIT: "Benefício em Dobro (Pediu 1, levou 2)",
  CASH_CREDIT: "Crédito na Comanda (R$)",
}

function offerSummary(promotion: Promotion) {
  if (promotion.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (promotion.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (promotion.offerType === "CASH_CREDIT") return promotion.creditAmount ? `R$ ${promotion.creditAmount} de crédito` : "Crédito na comanda"
  if (promotion.discountPercentage) return `${promotion.discountPercentage}% off`
  if (promotion.originalPrice && promotion.discountedPrice) {
    return `De R$ ${promotion.originalPrice} por R$ ${promotion.discountedPrice}`
  }
  return "Desconto"
}

export function PromotionsTab() {
  const { companies } = useCompanies()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Promotion | "new" | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Promotion[]>("/api/admin/promotions")
      .then(setPromotions)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleToggleActive = async (promotion: Promotion) => {
    await adminFetch(`/api/admin/promotions/${promotion.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !promotion.active }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleDelete = async (promotion: Promotion) => {
    if (!confirm(`Excluir a promoção "${promotion.title}"?`)) return
    await adminFetch(`/api/admin/promotions/${promotion.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} variant="brand">
          <Plus className="h-4 w-4 mr-2" />
          Nova Promoção
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : promotions.length === 0 ? (
        <EmptyState message="Nenhuma promoção cadastrada ainda." />
      ) : (
        <div className="grid gap-3">
          {promotions.map((promotion) => (
            <div
              key={promotion.id}
              className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 flex gap-3"
            >
              {promotion.bannerUrl && (
                <img
                  src={promotion.bannerUrl}
                  alt={promotion.title}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0 hidden sm:block"
                />
              )}
              <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#3E2415]">{promotion.title}</p>
                    <StatusBadge status={promotion.active ? "ACTIVE" : "INACTIVE"} />
                    <span className="text-[10px] font-medium text-orange-700 bg-orange-50 rounded-full px-2 py-0.5">
                      {offerSummary(promotion)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {promotion.company.name} ·{" "}
                    {promotion.units.length > 0 ? promotion.units.map((u) => u.unit.name).join(", ") : "Todas as unidades"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(promotion.validFrom).toLocaleDateString("pt-BR")} –{" "}
                    {new Date(promotion.validUntil).toLocaleDateString("pt-BR")} · Custo R$ {promotion.cost} ·{" "}
                    {promotion.usedCount} usos{promotion.stock !== null ? ` de ${promotion.stock}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconActionButton icon={Pencil} label="Editar" onClick={() => setEditing(promotion)} />
                  <IconActionButton
                    icon={Power}
                    label={promotion.active ? "Inativar" : "Ativar"}
                    onClick={() => handleToggleActive(promotion)}
                  />
                  <IconActionButton
                    icon={Trash2}
                    label="Excluir"
                    onClick={() => handleDelete(promotion)}
                    className="text-red-600 hover:text-red-700"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PromotionDialog
          promotion={editing === "new" ? null : editing}
          companies={companies}
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

function PromotionDialog({
  promotion,
  companies,
  onClose,
  onSaved,
}: {
  promotion: Promotion | null
  companies: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [companyId, setCompanyId] = useState(promotion?.company.id ?? companies[0]?.id ?? "")
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
        await adminFetch(`/api/admin/promotions/${promotion.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      } else {
        await adminFetch("/api/admin/promotions", {
          method: "POST",
          body: JSON.stringify({ companyId, ...payload }),
        })
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
          {!promotion && (
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <FileUploadField
            label="Banner de capa da promoção"
            hint="Tamanho recomendado: 1200x630px | Formatos: PNG, JPG, WEBP | Peso máximo: 3MB"
            accept="image/png,image/jpeg,image/webp"
            currentUrl={bannerUrl || null}
            uploadEndpoint="/api/admin/uploads"
            kind="promotion-photo"
            onUploaded={setBannerUrl}
            variant="image"
            maxSizeMB={3}
          />
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
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-orange-50/50 border border-orange-100">
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
              <p className="col-span-3 text-[11px] text-gray-500">
                Preencha 2 dos 3 campos — o terceiro é calculado automaticamente.
              </p>
            </div>
          )}

          {offerType === "CASH_CREDIT" && (
            <div className="space-y-2 p-3 rounded-lg bg-orange-50/50 border border-orange-100">
              <Label className="text-xs">Valor do crédito na comanda (R$)</Label>
              <Input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="ex: 30,00" required />
              <p className="text-[11px] text-gray-500">
                Use a descrição acima para as condições que o atendente do PDV deve validar ao escanear o QR Code do indicado.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Válida de</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Válida até</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
