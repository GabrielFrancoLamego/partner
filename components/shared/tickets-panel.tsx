"use client"

import { useEffect, useState } from "react"
import { Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"

type Ticket = {
  id: string
  subject: string
  status: "OPEN" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED"
  updatedAt: string
  messages: { id: string; message: string; createdAt: string; author: { name: string; role: string } }[]
}

/** Central de Chamados reutilizável — usada em /company/comunicacao e /partner (mesma API shape, base path diferente). */
export function TicketsPanel({ basePath }: { basePath: "/api/company/tickets" | "/api/partner/tickets" }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [viewing, setViewing] = useState<Ticket | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Ticket[]>(basePath).then(setTickets).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Central de Ajuda</h1>
          <p className="text-gray-600 mt-1 text-sm">Abra um chamado e acompanhe a resposta do Admin da plataforma.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : tickets.length === 0 ? (
        <EmptyState message="Nenhum chamado aberto ainda." />
      ) : (
        <div className="grid gap-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setViewing(t)}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-left"
            >
              <div className="min-w-0">
                <p className="font-medium text-[#3E2415] text-sm truncate">{t.subject}</p>
                <p className="text-xs text-gray-500">{t.messages.length} mensagens · atualizado em {new Date(t.updatedAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <StatusBadge status={t.status} />
            </button>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <CreateTicketDialog
          basePath={basePath}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}

      {viewing && (
        <TicketThreadDialog
          basePath={basePath}
          ticket={viewing}
          onClose={() => setViewing(null)}
          onReplied={() => {
            setViewing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function CreateTicketDialog({
  basePath,
  onClose,
  onCreated,
}: {
  basePath: string
  onClose: () => void
  onCreated: () => void
}) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(basePath, { method: "POST", body: JSON.stringify({ subject, message }) })
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

function TicketThreadDialog({
  basePath,
  ticket,
  onClose,
  onReplied,
}: {
  basePath: string
  ticket: Ticket
  onClose: () => void
  onReplied: () => void
}) {
  const [reply, setReply] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleReply = async () => {
    if (!reply.trim()) return
    setIsSubmitting(true)
    try {
      await adminFetch(`${basePath}/${ticket.id}/messages`, { method: "POST", body: JSON.stringify({ message: reply }) })
      onReplied()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao responder")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {ticket.messages.map((m) => (
            <div key={m.id} className={`p-3 rounded-xl text-sm ${m.author.role === "ADMIN" ? "bg-orange-50" : "bg-gray-50"}`}>
              <p className="text-xs font-medium text-gray-500 mb-1">
                {m.author.name} · {new Date(m.createdAt).toLocaleString("pt-BR")}
              </p>
              <p className="text-[#3E2415]">{m.message}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escreva uma resposta..." rows={2} />
          <Button onClick={handleReply} disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
