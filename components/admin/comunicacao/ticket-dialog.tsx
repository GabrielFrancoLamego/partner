"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

type TicketDetail = {
  id: string
  subject: string
  status: string
  company: { id: string; name: string } | null
  author: { id: string; name: string; role: string }
  messages: { id: string; message: string; createdAt: string; author: { id: string; name: string; role: string } }[]
}

export function TicketDialog({ ticketId, onClose, onUpdated }: { ticketId: string; onClose: () => void; onUpdated: () => void }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState("")
  const [isSending, setIsSending] = useState(false)

  const reload = () => {
    adminFetch<TicketDetail>(`/api/admin/tickets/${ticketId}`).then(setTicket)
  }

  useEffect(reload, [ticketId])

  const handleStatusChange = async (status: string) => {
    await adminFetch(`/api/admin/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(
      (e) => alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    reload()
    onUpdated()
  }

  const handleReply = async () => {
    if (!reply.trim()) return
    setIsSending(true)
    try {
      await adminFetch(`/api/admin/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply }),
      })
      setReply("")
      reload()
      onUpdated()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao responder")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticket?.subject ?? "Carregando..."}</DialogTitle>
        </DialogHeader>

        {ticket && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                {ticket.author.name} ({ticket.author.role}){ticket.company ? ` · ${ticket.company.name}` : ""}
              </p>
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Aberto</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em execução</SelectItem>
                  <SelectItem value="ANSWERED">Respondido</SelectItem>
                  <SelectItem value="RESOLVED">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto border-t border-b border-gray-100 py-3">
              {ticket.messages.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma resposta ainda.</p>
              ) : (
                ticket.messages.map((message) => (
                  <div key={message.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#3E2415]">{message.author.name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{message.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Textarea placeholder="Escreva uma resposta..." value={reply} onChange={(e) => setReply(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  onClick={handleReply}
                  disabled={isSending || !reply.trim()}
                  className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                >
                  Responder
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
