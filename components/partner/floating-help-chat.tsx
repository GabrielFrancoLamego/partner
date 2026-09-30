"use client"

import { useEffect, useState } from "react"
import { MessageCircle, X, ArrowLeft, Send, ShieldCheck, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

type Ticket = {
  id: string
  subject: string
  companyId: string | null
  status: string
  messages: { id: string; message: string; createdAt: string; author: { name: string; role: string } }[]
}
type Membership = { companyId: string; companyName: string }
type ProgramListItem = { companyId: string; company: { name: string }; membership: { status: string } | null }

type Target = { type: "admin" } | { type: "company"; companyId: string; companyName: string }

/** Balão de Ajuda flutuante (canto inferior direito) — escolhe Suporte da Plataforma ou o Estabelecimento, e conversa via Ticket/TicketMessage. */
export function FloatingHelpChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [message, setMessage] = useState("")
  const [subject, setSubject] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (!isOpen || hasLoaded) return
    Promise.all([
      adminFetch<Ticket[]>("/api/partner/tickets"),
      adminFetch<ProgramListItem[]>("/api/partner/explorar").catch(() => [] as ProgramListItem[]),
    ]).then(([t, programs]) => {
      setTickets(t)
      const uniqueCompanies = new Map(programs.filter((p) => p.membership?.status === "ACTIVE").map((p) => [p.companyId, p.company.name]))
      setMemberships(Array.from(uniqueCompanies, ([companyId, companyName]) => ({ companyId, companyName })))
      setHasLoaded(true)
    })
  }, [isOpen, hasLoaded])

  const reload = () => {
    adminFetch<Ticket[]>("/api/partner/tickets").then(setTickets)
  }

  const activeTicket = target
    ? tickets.find((t) => (target.type === "admin" ? t.companyId === null : t.companyId === target.companyId))
    : null

  const handleSend = async () => {
    if (!message.trim() || !target) return
    setIsSubmitting(true)
    try {
      if (activeTicket) {
        await adminFetch(`/api/partner/tickets/${activeTicket.id}/messages`, { method: "POST", body: JSON.stringify({ message }) })
      } else {
        await adminFetch("/api/partner/tickets", {
          method: "POST",
          body: JSON.stringify({
            subject: subject.trim() || "Conversa via chat de ajuda",
            message,
            companyId: target.type === "company" ? target.companyId : undefined,
          }),
        })
      }
      setMessage("")
      setSubject("")
      reload()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao enviar mensagem")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed bottom-[calc(1rem+var(--safe-bottom))] right-4 z-50">
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ height: "min(70vh, 520px)" }}>
          <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {target && (
                <button onClick={() => setTarget(null)} className="flex-shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <p className="font-semibold text-sm truncate">
                {!target ? "Central de Ajuda" : target.type === "admin" ? "Suporte da Plataforma" : target.companyName}
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} className="flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!target ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">Com quem você quer falar?</p>
                <button
                  onClick={() => setTarget({ type: "admin" })}
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left"
                >
                  <ShieldCheck className="h-4 w-4 text-[#F58220] flex-shrink-0" />
                  <span className="text-sm text-[#3E2415]">Falar com o Suporte da Plataforma (Admin Global)</span>
                </button>
                {memberships.map((m) => (
                  <button
                    key={m.companyId}
                    onClick={() => setTarget({ type: "company", companyId: m.companyId, companyName: m.companyName })}
                    className="w-full flex items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left"
                  >
                    <Building2 className="h-4 w-4 text-[#F58220] flex-shrink-0" />
                    <span className="text-sm text-[#3E2415]">Falar com o Estabelecimento ({m.companyName})</span>
                  </button>
                ))}
                {memberships.length === 0 && (
                  <p className="text-[11px] text-gray-400 px-1">Adira a um Programa de Parceria para poder falar direto com o estabelecimento.</p>
                )}
              </div>
            ) : activeTicket ? (
              <div className="space-y-2">
                {activeTicket.messages.map((m) => (
                  <div key={m.id} className={`p-2.5 rounded-xl text-xs max-w-[85%] ${m.author.role === "PARTNER" ? "bg-[#FFF7ED] ml-auto" : "bg-gray-50"}`}>
                    <p className="text-[10px] font-medium text-gray-400 mb-0.5">{m.author.name}</p>
                    <p className="text-[#3E2415]">{m.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Nenhuma conversa ainda — envie a primeira mensagem.</p>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto (opcional)"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2"
                />
              </div>
            )}
          </div>

          {target && (
            <div className="p-2.5 border-t border-gray-100 flex items-end gap-2 flex-shrink-0">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva sua mensagem..."
                rows={1}
                className="text-sm resize-none"
              />
              <Button size="icon" disabled={isSubmitting || !message.trim()} onClick={handleSend} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white flex-shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Ajuda"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
