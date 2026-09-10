"use client"

import { useEffect, useState } from "react"
import { Plus, Copy, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard, MobileCardAction } from "@/components/admin/mobile-card"

type RegistrationLink = {
  id: string
  token: string
  role: string
  active: boolean
  company: { id: string; name: string }
  _count: { requests: number }
}

export function LinksTab() {
  const { companies } = useCompanies()
  const [links, setLinks] = useState<RegistrationLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<RegistrationLink[]>("/api/admin/registration-links")
      .then(setLinks)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleToggle = async (link: RegistrationLink) => {
    await adminFetch(`/api/admin/registration-links/${link.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !link.active }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao atualizar"))
    reload()
  }

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/cadastro/${token}`
    navigator.clipboard.writeText(url).then(() => alert("Link copiado: " + url))
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Links públicos de auto-cadastro de colaboradores. Cada envio feito através do link entra na aba
        "Aprovações Pendentes" antes de virar um usuário real.
      </p>
      <div className="flex justify-end">
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Link
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : links.length === 0 ? (
        <EmptyState message="Nenhum link de auto-cadastro criado ainda." />
      ) : (
        <>
          <MobileCardList>
            {links.map((link) => (
              <MobileCard
                key={link.id}
                title={link.company.name}
                subtitle={link.role}
                badges={<StatusBadge status={link.active ? "ACTIVE" : "INACTIVE"} />}
                fields={[{ label: "Cadastros recebidos", value: link._count.requests }]}
                actions={
                  <>
                    <MobileCardAction icon={Copy} label="Copiar link" onClick={() => handleCopy(link.token)} />
                    <MobileCardAction
                      icon={Power}
                      label={link.active ? "Desativar" : "Ativar"}
                      onClick={() => handleToggle(link)}
                    />
                  </>
                }
              />
            ))}
          </MobileCardList>

          <TableDesktop>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Papel concedido</th>
                <th className="px-4 py-3 font-medium">Cadastros recebidos</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#3E2415]">{link.company.name}</td>
                  <td className="px-4 py-3 text-gray-600">{link.role}</td>
                  <td className="px-4 py-3 text-gray-600">{link._count.requests}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={link.active ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(link.token)} title="Copiar link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(link)}
                        title={link.active ? "Desativar" : "Ativar"}
                      >
                        <Power className="h-4 w-4" />
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
        <CreateLinkDialog
          companies={companies}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function CreateLinkDialog({
  companies,
  onClose,
  onCreated,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "")
  const [role, setRole] = useState("EMPLOYEE")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/admin/registration-links", {
        method: "POST",
        body: JSON.stringify({ companyId, role }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar link")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Link de Auto-cadastro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
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
          <div className="space-y-2">
            <Label>Papel concedido ao se cadastrar</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Operador/Scanner</SelectItem>
                <SelectItem value="COMPANY_GERENTE">Gerente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !companyId}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Criar Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
