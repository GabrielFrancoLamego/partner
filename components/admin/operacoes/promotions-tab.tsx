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

type Promotion = {
  id: string
  title: string
  description: string
  validFrom: string
  validUntil: string
  cost: string
  stock: number | null
  usedCount: number
  active: boolean
  company: { id: string; name: string }
  units: { unit: { id: string; name: string } }[]
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
        <Button
          onClick={() => setEditing("new")}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
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
              className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#3E2415]">{promotion.title}</p>
                    <StatusBadge status={promotion.active ? "ACTIVE" : "INACTIVE"} />
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
                  <Button variant="ghost" size="icon" onClick={() => setEditing(promotion)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(promotion)}
                    title={promotion.active ? "Inativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(promotion)}
                    title="Excluir"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
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
  const [validFrom, setValidFrom] = useState(promotion?.validFrom.slice(0, 10) ?? "")
  const [validUntil, setValidUntil] = useState(promotion?.validUntil.slice(0, 10) ?? "")
  const [cost, setCost] = useState(promotion?.cost ?? "")
  const [stock, setStock] = useState(promotion?.stock?.toString() ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const payload = {
        title,
        description,
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
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
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
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
