"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Power, Trash2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { formatPhone, isValidEmail, isValidPhone } from "@/lib/validators"

type Affiliate = {
  id: string
  name: string
  email: string | null
  phone: string | null
  code: string
  active: boolean
  bonusPerPartner: string
  milestoneClientCount: number
  milestoneBonus: string
  pixKey: string | null
  walletBalance: string
  _count: { partners: number; joinRequests: number; payouts: number }
}

const currency = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function AffiliatesTab() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Affiliate | "new" | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Affiliate[]>("/api/admin/affiliates")
      .then(setAffiliates)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleToggleActive = async (affiliate: Affiliate) => {
    await adminFetch(`/api/admin/affiliates/${affiliate.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !affiliate.active }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleDelete = async (affiliate: Affiliate) => {
    if (!confirm(`Excluir o afiliado "${affiliate.name}"?`)) return
    await adminFetch(`/api/admin/affiliates/${affiliate.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/join/partner?ref=${code}`
    navigator.clipboard.writeText(url).then(() => alert("Link copiado: " + url))
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Afiliados/Influencers com link exclusivo de indicação de parceiros. Ganham um bônus quando o parceiro
        indicado é aprovado, e um bônus extra quando ele atinge seus primeiros clientes convertidos.
      </p>
      <div className="flex justify-end">
        <Button
          onClick={() => setEditing("new")}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Afiliado
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : affiliates.length === 0 ? (
        <EmptyState message="Nenhum afiliado cadastrado ainda." />
      ) : (
        <div className="grid gap-3">
          {affiliates.map((affiliate) => (
            <div key={affiliate.id} className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#3E2415]">{affiliate.name}</p>
                    <StatusBadge status={affiliate.active ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {affiliate._count.partners} parceiros indicados · {affiliate._count.payouts} pagamentos · saldo{" "}
                    {currency(affiliate.walletBalance)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Bônus por parceiro: {currency(affiliate.bonusPerPartner)} · Bônus ao atingir{" "}
                    {affiliate.milestoneClientCount} clientes: {currency(affiliate.milestoneBonus)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleCopyLink(affiliate.code)} title="Copiar link de indicação">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(affiliate)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(affiliate)}
                    title={affiliate.active ? "Inativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(affiliate)}
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
        <AffiliateDialog
          affiliate={editing === "new" ? null : editing}
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

function AffiliateDialog({
  affiliate,
  onClose,
  onSaved,
}: {
  affiliate: Affiliate | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(affiliate?.name ?? "")
  const [email, setEmail] = useState(affiliate?.email ?? "")
  const [phone, setPhone] = useState(affiliate?.phone ?? "")
  const [bonusPerPartner, setBonusPerPartner] = useState(affiliate?.bonusPerPartner ?? "0")
  const [milestoneClientCount, setMilestoneClientCount] = useState(String(affiliate?.milestoneClientCount ?? 10))
  const [milestoneBonus, setMilestoneBonus] = useState(affiliate?.milestoneBonus ?? "0")
  const [pixKey, setPixKey] = useState(affiliate?.pixKey ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const emailError = email && !isValidEmail(email) ? "Email inválido" : ""
  const phoneError = phone && !isValidPhone(phone) ? "Telefone inválido" : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (emailError || phoneError) {
      setError(emailError || phoneError)
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        name,
        email: email || undefined,
        phone: phone || undefined,
        bonusPerPartner: Number(bonusPerPartner),
        milestoneClientCount: Number(milestoneClientCount),
        milestoneBonus: Number(milestoneBonus),
        pixKey: pixKey || undefined,
      }
      if (affiliate) {
        await adminFetch(`/api/admin/affiliates/${affiliate.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      } else {
        await adminFetch("/api/admin/affiliates", { method: "POST", body: JSON.stringify(payload) })
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
          <DialogTitle>{affiliate ? "Editar Afiliado" : "Novo Afiliado"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bônus por parceiro aprovado (R$)</Label>
              <Input type="number" step="0.01" value={bonusPerPartner} onChange={(e) => setBonusPerPartner(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nº de clientes p/ milestone</Label>
              <Input type="number" value={milestoneClientCount} onChange={(e) => setMilestoneClientCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bônus de milestone (R$)</Label>
              <Input type="number" step="0.01" value={milestoneBonus} onChange={(e) => setMilestoneBonus(e.target.value)} />
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
