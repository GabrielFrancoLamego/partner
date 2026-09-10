"use client"

import { useEffect, useState } from "react"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { CompanyFilter } from "@/components/admin/admin-filters"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { TicketDialog } from "@/components/admin/comunicacao/ticket-dialog"

type Ticket = {
  id: string
  subject: string
  status: string
  updatedAt: string
  company: { id: string; name: string } | null
  author: { id: string; name: string; role: string }
  _count: { messages: number }
}

type SearchableUser = { id: string; name: string; email: string; role: string }

export default function AdminComunicacaoPage() {
  const { companies } = useCompanies()
  const [companyId, setCompanyId] = useState("all")
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    const params = new URLSearchParams({ companyId })
    if (status !== "all") params.set("status", status)
    if (q) params.set("q", q)
    adminFetch<Ticket[]>(`/api/admin/tickets?${params}`)
      .then(setTickets)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [companyId, status, q])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Central de Comunicação</h1>
          <p className="text-gray-600 mt-1 text-sm">Chamados e ocorrências de toda a plataforma</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por assunto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <CompanyFilter companies={companies} value={companyId} onChange={setCompanyId} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="OPEN">Abertas</SelectItem>
            <SelectItem value="IN_PROGRESS">Em execução</SelectItem>
            <SelectItem value="ANSWERED">Respondidas</SelectItem>
            <SelectItem value="RESOLVED">Concluídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100">
        {isLoading ? (
          <LoadingState />
        ) : tickets.length === 0 ? (
          <EmptyState message="Nenhum chamado encontrado." />
        ) : (
          <>
            <MobileCardList>
              {tickets.map((ticket) => (
                <button key={ticket.id} onClick={() => setOpenTicketId(ticket.id)} className="w-full text-left">
                  <MobileCard
                    title={ticket.subject}
                    subtitle={`${ticket.author.name} (${ticket.author.role})`}
                    badges={<StatusBadge status={ticket.status} />}
                    fields={[
                      { label: "Empresa", value: ticket.company?.name ?? "—" },
                      { label: "Atualizado", value: new Date(ticket.updatedAt).toLocaleDateString("pt-BR") },
                    ]}
                  />
                </button>
              ))}
            </MobileCardList>

            <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Assunto</th>
                  <th className="px-4 py-3 font-medium">Autor</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setOpenTicketId(ticket.id)}
                  >
                    <td className="px-4 py-3 text-[#3E2415] font-medium">{ticket.subject}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {ticket.author.name} ({ticket.author.role})
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ticket.company?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(ticket.updatedAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableDesktop>
          </>
        )}
      </div>

      {openTicketId && (
        <TicketDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} onUpdated={reload} />
      )}

      {isCreateOpen && (
        <NewTicketDialog
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

function NewTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<SearchableUser[]>([])
  const [targetUserId, setTargetUserId] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<SearchableUser[]>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [query])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!targetUserId) {
      setError("Selecione o usuário")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch("/api/admin/tickets", { method: "POST", body: JSON.stringify({ targetUserId, subject, message }) })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao abrir chamado")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Chamado</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Buscar usuário..." />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input placeholder="Buscar por nome/email..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {u.email} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
