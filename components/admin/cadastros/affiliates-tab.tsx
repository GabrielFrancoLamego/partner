"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Power, Trash2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { formatPhone, isValidEmail, isValidPhone } from "@/lib/validators"

type RewardType = "FIXED" | "PERCENTAGE"

type Affiliate = {
  id: string
  name: string
  email: string | null
  phone: string | null
  code: string
  active: boolean
  rewardType: RewardType
  bonusPerPartner: string
  bonusPercentage: string | null
  milestoneClientCount: number
  milestoneBonus: string
  pixKey: string | null
  walletBalance: string
  partnerProfile: { id: string; fullName: string | null; user: { name: string; email: string } } | null
  _count: { partners: number; joinRequests: number; payouts: number }
}

type EligiblePartner = {
  id: string
  name: string
  email: string
  status: string
  partnerProfile: { id: string; fullName: string | null; whatsapp: string | null; phone: string | null } | null
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
    const url = `${window.location.origin}/join/partner/${code}`
    navigator.clipboard.writeText(url).then(() => alert("Link copiado: " + url))
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Afiliados/Influencers com link exclusivo de indicação de parceiros. Ganham um bônus quando o parceiro
        indicado é aprovado (fixo ou % sobre a 1ª comissão dele), e um bônus extra quando ele atinge seus primeiros
        clientes convertidos no PDV. Só parceiros com conta ATIVA podem ser promovidos a Afiliado — se a conta for
        desativada, o link de indicação dele para de funcionar automaticamente.
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
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#3E2415]">{affiliate.name}</p>
                    <StatusBadge status={affiliate.active ? "ACTIVE" : "INACTIVE"} />
                    {affiliate.partnerProfile && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                        Parceiro promovido
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {affiliate._count.partners} parceiros indicados · {affiliate._count.payouts} pagamentos · saldo{" "}
                    {currency(affiliate.walletBalance)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Bônus por parceiro:{" "}
                    {affiliate.rewardType === "PERCENTAGE"
                      ? `${affiliate.bonusPercentage}% da 1ª comissão`
                      : currency(affiliate.bonusPerPartner)}{" "}
                    · Bônus ao atingir {affiliate.milestoneClientCount} clientes: {currency(affiliate.milestoneBonus)}
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
  const [eligiblePartners, setEligiblePartners] = useState<EligiblePartner[]>([])
  const [partnerProfileId, setPartnerProfileId] = useState(affiliate?.partnerProfile?.id ?? "")
  const [name, setName] = useState(affiliate?.name ?? "")
  const [email, setEmail] = useState(affiliate?.email ?? "")
  const [phone, setPhone] = useState(affiliate?.phone ?? "")
  const [rewardType, setRewardType] = useState<RewardType>(affiliate?.rewardType ?? "FIXED")
  const [bonusPerPartner, setBonusPerPartner] = useState(affiliate?.bonusPerPartner ?? "0")
  const [bonusPercentage, setBonusPercentage] = useState(affiliate?.bonusPercentage ?? "")
  const [milestoneClientCount, setMilestoneClientCount] = useState(String(affiliate?.milestoneClientCount ?? 10))
  const [milestoneBonus, setMilestoneBonus] = useState(affiliate?.milestoneBonus ?? "0")
  const [pixKey, setPixKey] = useState(affiliate?.pixKey ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (affiliate) return // edição não troca o parceiro promovido
    adminFetch<EligiblePartner[]>("/api/admin/partners")
      .then((partners) => setEligiblePartners(partners.filter((p) => p.status === "ACTIVE")))
      .catch(() => {})
  }, [affiliate])

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
        partnerProfileId: partnerProfileId || undefined,
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        rewardType,
        bonusPerPartner: rewardType === "FIXED" ? Number(bonusPerPartner) : 0,
        bonusPercentage: rewardType === "PERCENTAGE" ? Number(bonusPercentage) : null,
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

          {!affiliate && (
            <div className="space-y-2">
              <Label>Promover parceiro existente (opcional)</Label>
              <Select
                value={partnerProfileId || "none"}
                onValueChange={(v) => {
                  setPartnerProfileId(v === "none" ? "" : v)
                  const p = eligiblePartners.find((ep) => ep.partnerProfile?.id === v)
                  if (p) {
                    setName(p.partnerProfile?.fullName || p.name)
                    setEmail(p.email)
                    setPhone(p.partnerProfile?.whatsapp || p.partnerProfile?.phone || "")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ou cadastre um afiliado externo abaixo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Afiliado externo (sem conta de parceiro)</SelectItem>
                  {eligiblePartners
                    .filter((p) => p.partnerProfile)
                    .map((p) => (
                      <SelectItem key={p.partnerProfile!.id} value={p.partnerProfile!.id}>
                        {p.partnerProfile?.fullName || p.name} ({p.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Só parceiros com conta ATIVA aparecem aqui.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={!!partnerProfileId} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!partnerProfileId} />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Tipo de recompensa por parceiro indicado</Label>
            <Select value={rewardType} onValueChange={(v) => setRewardType(v as RewardType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                <SelectItem value="PERCENTAGE">Porcentagem (%) da 1ª comissão do indicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rewardType === "FIXED" ? (
              <div className="space-y-2">
                <Label>Valor fixo (R$)</Label>
                <Input type="number" step="0.01" value={bonusPerPartner} onChange={(e) => setBonusPerPartner(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Porcentagem (%)</Label>
                <Input type="number" step="0.1" value={bonusPercentage} onChange={(e) => setBonusPercentage(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
