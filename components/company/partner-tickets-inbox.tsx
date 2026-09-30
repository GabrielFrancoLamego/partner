"use client"

import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"

type Ticket = {
  id: string
  subject: string
  status: "OPEN" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED"
  updatedAt: string
  author: { id: string; name: string }
  messages: { id: string; message: string; createdAt: string; author: { name: string; role: string } }[]
}

/** Chamados abertos por Parceiros endereçados à empresa (balão de Ajuda flutuante do parceiro) — Master/Gerente respondem. */
export function PartnerTicketsInbox() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewing, setViewing] = useState<Ticket | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Ticket[]>("/api/company/partner-tickets")
      .then(setTickets)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  if (isLoading) return <LoadingState />
  if (tickets.length === 0) return <EmptyState message="Nenhum chamado de parceiro por aqui ainda." />

  return (
    <div className="space-y-2">
      {tickets.map((t) => (
        <button
          key={t.id}
          onClick={() => setViewing(t)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-left"
        >
          <div className="min-w-0">
            <p className="font-medium text-[#3E2415] text-sm truncate">{t.subject}</p>
            <p className="text-xs text-gray-500">
              {t.author.name} · {t.messages.length} mensagens · {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <StatusBadge status={t.status} />
        </button>
      ))}

      {viewing && (
        <ThreadDialog
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

function ThreadDialog({ ticket, onClose, onReplied }: { ticket: Ticket; onClose: () => void; onReplied: () => void }) {
  const [reply, setReply] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleReply = async () => {
    if (!reply.trim()) return
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/partner-tickets/${ticket.id}/messages`, { method: "POST", body: JSON.stringify({ message: reply }) })
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
          <DialogTitle>
            {ticket.subject} — {ticket.author.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {ticket.messages.map((m) => (
            <div key={m.id} className={`p-3 rounded-xl text-sm ${m.author.role === "PARTNER" ? "bg-gray-50" : "bg-orange-50"}`}>
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
