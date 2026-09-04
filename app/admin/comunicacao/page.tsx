"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { CompanyFilter } from "@/components/admin/admin-filters"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
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

export default function AdminComunicacaoPage() {
  const { companies } = useCompanies()
  const [companyId, setCompanyId] = useState("all")
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)

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
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Central de Comunicação</h1>
        <p className="text-gray-600 mt-1 text-sm">Chamados e ocorrências de toda a plataforma</p>
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
          <div className="overflow-x-auto rounded-xl border border-gray-100">
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
          </div>
        )}
      </div>

      {openTicketId && (
        <TicketDialog ticketId={openTicketId} onClose={() => setOpenTicketId(null)} onUpdated={reload} />
      )}
    </div>
  )
}
