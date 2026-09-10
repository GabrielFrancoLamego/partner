"use client"

import { useEffect, useState } from "react"
import { Plus, Lock, Unlock, Trash2, KeyRound, IdCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { ReasonDialog } from "@/components/admin/reason-dialog"
import { TableDesktop, MobileCardList, MobileCard, MobileCardAction } from "@/components/admin/mobile-card"
import { EmployeeProfileDialog } from "./employee-profile-dialog"

type StaffUser = {
  id: string
  name: string
  email: string
  role: string
  status: "ACTIVE" | "INACTIVE"
  companyId: string | null
  company: { id: string; name: string } | null
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin da Plataforma",
  COMPANY_MASTER: "Master",
  COMPANY_GERENTE: "Gerente",
  COMPANY_FINANCE: "Financeiro",
  EMPLOYEE: "Operador/Scanner",
}

export function UsersTab() {
  const { companies } = useCompanies()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [resetLink, setResetLink] = useState<string | null>(null)
  const [viewingProfile, setViewingProfile] = useState<StaffUser | null>(null)
  const [blocking, setBlocking] = useState<StaffUser | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<StaffUser[]>("/api/admin/users")
      .then(setUsers)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleConfirmToggleStatus = async (user: StaffUser, reason: string) => {
    await adminFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", blockReason: reason }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao atualizar"))
    setBlocking(null)
    reload()
  }

  const handleDelete = async (user: StaffUser) => {
    if (!confirm(`Excluir o usuário "${user.name}"?`)) return
    await adminFetch(`/api/admin/users/${user.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  const handleResetPassword = async (user: StaffUser) => {
    try {
      const { resetLink } = await adminFetch<{ resetLink: string }>(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
      })
      setResetLink(resetLink)
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao gerar link")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState message="Nenhum usuário cadastrado ainda." />
      ) : (
        <>
          <MobileCardList>
            {users.map((user) => (
              <MobileCard
                key={user.id}
                title={user.name}
                subtitle={user.email}
                badges={<StatusBadge status={user.status} />}
                fields={[
                  { label: "Papel", value: ROLE_LABELS[user.role] ?? user.role },
                  { label: "Empresa", value: user.company?.name ?? "—" },
                ]}
                actions={
                  <>
                    {user.role === "EMPLOYEE" && (
                      <MobileCardAction icon={IdCard} label="Perfil" onClick={() => setViewingProfile(user)} />
                    )}
                    <MobileCardAction icon={KeyRound} label="Redefinir senha" onClick={() => handleResetPassword(user)} />
                    <MobileCardAction
                      icon={user.status === "ACTIVE" ? Lock : Unlock}
                      label={user.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
                      onClick={() => setBlocking(user)}
                    />
                    <MobileCardAction icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDelete(user)} />
                  </>
                }
              />
            ))}
          </MobileCardList>

          <TableDesktop>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#3E2415]">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 text-gray-600">{user.company?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {user.role === "EMPLOYEE" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingProfile(user)}
                          title="Ver perfil / documentos"
                        >
                          <IdCard className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResetPassword(user)}
                        title="Disparar redefinição de senha"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setBlocking(user)}
                        title={user.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
                      >
                        {user.status === "ACTIVE" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user)}
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
          </TableDesktop>
        </>
      )}

      {isCreateOpen && (
        <CreateUserDialog
          companies={companies}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
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
              Ambiente local não envia email — copie e envie este link manualmente ao usuário:
            </p>
            <Input readOnly value={resetLink} onFocus={(e) => e.target.select()} />
            <DialogFooter>
              <Button onClick={() => setResetLink(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {viewingProfile && (
        <EmployeeProfileDialog
          userId={viewingProfile.id}
          userName={viewingProfile.name}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {blocking && (
        <ReasonDialog
          title={blocking.status === "ACTIVE" ? `Bloquear ${blocking.name}` : `Desbloquear ${blocking.name}`}
          description="Esta ação é registrada na trilha de auditoria."
          confirmLabel={blocking.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
          destructive={blocking.status === "ACTIVE"}
          onConfirm={(reason) => handleConfirmToggleStatus(blocking, reason)}
          onClose={() => setBlocking(null)}
        />
      )}
    </div>
  )
}

function CreateUserDialog({
  companies,
  onClose,
  onCreated,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("COMPANY_MASTER")
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, role, companyId: role === "ADMIN" ? null : companyId }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar usuário")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role !== "ADMIN" && (
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
          <p className="text-xs text-gray-400">Senha inicial padrão do ambiente local: 123456</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
