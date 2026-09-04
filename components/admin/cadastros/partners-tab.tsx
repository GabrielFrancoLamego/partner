"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Lock, Unlock, Trash2, KeyRound, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { AvatarUpload } from "@/components/admin/avatar-upload"

type Partner = {
  id: string
  name: string
  email: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  partnerProfile: {
    partnerType: "INDIVIDUAL" | "AGENCY"
    document: string | null
    phone: string | null
    walletBalance: string
    fullName: string | null
    nickname: string | null
    whatsapp: string | null
    email: string | null
    cpf: string | null
    bio: string | null
    pixKey: string | null
    photoUrl: string | null
    parent: { id: string; user: { name: string } } | null
  } | null
}

export function PartnersTab() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [resetLink, setResetLink] = useState<string | null>(null)

  const reload = () => {
    setIsLoading(true)
    const params = new URLSearchParams(query ? { q: query } : {})
    adminFetch<Partner[]>(`/api/admin/partners?${params}`)
      .then(setPartners)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [query])

  const handleToggleStatus = async (partner: Partner) => {
    await adminFetch(`/api/admin/partners/${partner.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: partner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao atualizar"))
    reload()
  }

  const handleDelete = async (partner: Partner) => {
    if (!confirm(`Excluir o parceiro "${partner.name}"?`)) return
    await adminFetch(`/api/admin/partners/${partner.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  const handleResetPassword = async (partner: Partner) => {
    try {
      const { resetLink } = await adminFetch<{ resetLink: string }>(
        `/api/admin/users/${partner.id}/reset-password`,
        { method: "POST" },
      )
      setResetLink(resetLink)
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao gerar link")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, apelido ou bio..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Parceiro
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : partners.length === 0 ? (
        <EmptyState message="Nenhum parceiro encontrado." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Agência</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#3E2415]">
                      {partner.partnerProfile?.fullName ?? partner.name}
                      {partner.partnerProfile?.nickname && (
                        <span className="text-gray-400 font-normal"> · @{partner.partnerProfile.nickname}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{partner.email}</p>
                    {partner.partnerProfile?.bio && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">{partner.partnerProfile.bio}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {partner.partnerProfile?.partnerType === "AGENCY" ? "Agência (PJ)" : "Pessoa física"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{partner.partnerProfile?.whatsapp ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{partner.partnerProfile?.parent?.user.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={partner.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(partner)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResetPassword(partner)}
                        title="Disparar redefinição de senha"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(partner)}
                        title={partner.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
                      >
                        {partner.status === "ACTIVE" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(partner)}
                        title="Excluir"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && (
        <PartnerDialog
          partner={null}
          onClose={() => setIsCreateOpen(false)}
          onSaved={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}

      {editing && (
        <PartnerDialog
          partner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      {resetLink && (
        <Dialog open onOpenChange={() => setResetLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link de redefinição de senha</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-2">
              Ambiente local não envia email — copie e envie este link manualmente ao parceiro:
            </p>
            <Input readOnly value={resetLink} onFocus={(e) => e.target.select()} />
            <DialogFooter>
              <Button onClick={() => setResetLink(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PartnerDialog({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null
  onClose: () => void
  onSaved: () => void
}) {
  const profile = partner?.partnerProfile
  const [name, setName] = useState(partner?.name ?? "")
  const [email, setEmail] = useState(partner?.email ?? "")
  const [fullName, setFullName] = useState(profile?.fullName ?? "")
  const [nickname, setNickname] = useState(profile?.nickname ?? "")
  const [partnerType, setPartnerType] = useState<"INDIVIDUAL" | "AGENCY">(profile?.partnerType ?? "INDIVIDUAL")
  const [document, setDocument] = useState(profile?.document ?? "")
  const [cpf, setCpf] = useState(profile?.cpf ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? "")
  const [contactEmail, setContactEmail] = useState(profile?.email ?? "")
  const [pixKey, setPixKey] = useState(profile?.pixKey ?? "")
  const [bio, setBio] = useState(profile?.bio ?? "")
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      if (partner) {
        await adminFetch(`/api/admin/partners/${partner.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            partnerType,
            document,
            cpf,
            phone,
            whatsapp,
            email: contactEmail,
            pixKey,
            fullName,
            nickname,
            bio,
          }),
        })
      } else {
        await adminFetch("/api/admin/partners", {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            partnerType,
            document,
            cpf,
            phone,
            whatsapp,
            contactEmail,
            fullName,
            nickname,
            bio,
          }),
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
          <DialogTitle>{partner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {partner && (
            <AvatarUpload
              label="Foto"
              ownerType="partner"
              ownerId={partner.id}
              field="photoUrl"
              value={photoUrl || null}
              onUploaded={setPhotoUrl}
              shape="circle"
            />
          )}

          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Apelido (login)</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="@apelido" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={partnerType} onValueChange={(v) => setPartnerType(v as "INDIVIDUAL" | "AGENCY")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Pessoa física</SelectItem>
                  <SelectItem value="AGENCY">Agência (PJ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!partner && (
            <div className="space-y-2">
              <Label>Email de login</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email de contato (opcional)</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>CPF (opcional — exigido no saque)</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{partnerType === "AGENCY" ? "CNPJ da agência" : "Documento adicional"}</Label>
              <Input value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Fale um pouco sobre você e o que faz"
            />
          </div>

          {!partner && <p className="text-xs text-gray-400">Senha inicial padrão do ambiente local: 123456</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              {partner ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
