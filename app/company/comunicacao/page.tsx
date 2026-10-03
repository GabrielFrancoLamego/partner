"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesSquare, Plus, Paperclip, Send, LifeBuoy, Handshake, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { TicketsPanel } from "@/components/shared/tickets-panel"
import { PartnerTicketsInbox } from "@/components/company/partner-tickets-inbox"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations, isCompanyMasterOrAdmin } from "@/lib/permissions"

type RecipientType = "SECTOR" | "ROLE" | "EMPLOYEE"
type MessageStatus = "SENT" | "PENDING_RESPONSE" | "RESPONDED" | "CONCLUDED"

type Message = {
  id: string
  subject: string
  body: string
  attachmentUrls: string[]
  status: MessageStatus
  recipientType: RecipientType
  recipientSector: { id: string; name: string } | null
  recipientRole: string | null
  recipientEmployee: { id: string; name: string } | null
  sender: { id: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  _count: { replies: number }
}

type Reply = { id: string; body: string; createdAt: string; author: { id: string; name: string; role: string } }
type MessageDetail = Message & { replies: Reply[] }

type Sector = { id: string; name: string }
type Employee = { id: string; name: string }

const ROLE_LABELS: Record<string, string> = {
  COMPANY_MASTER: "Master",
  COMPANY_GERENTE: "Gerência",
  COMPANY_FINANCE: "Financeiro",
  EMPLOYEE: "Colaboradores",
}
const STATUS_LABELS: Record<MessageStatus, string> = {
  SENT: "Enviada",
  PENDING_RESPONSE: "Pendente de Resposta",
  RESPONDED: "Respondida",
  CONCLUDED: "Concluída",
}
const STATUS_CLASSES: Record<MessageStatus, string> = {
  SENT: "bg-gray-100 text-gray-600",
  PENDING_RESPONSE: "bg-amber-100 text-amber-700",
  RESPONDED: "bg-blue-100 text-blue-700",
  CONCLUDED: "bg-green-100 text-green-700",
}

function recipientLabel(m: Message) {
  if (m.recipientType === "SECTOR") return `Setor: ${m.recipientSector?.name ?? "—"}`
  if (m.recipientType === "ROLE") return `Função: ${ROLE_LABELS[m.recipientRole ?? ""] ?? m.recipientRole}`
  return `Colaborador: ${m.recipientEmployee?.name ?? "—"}`
}

export default function CompanyCommunicationPage() {
  const user = useCompanyUser()
  const canSeePartnerTickets = canManageDailyOperations(user.role)
  const isMaster = isCompanyMasterOrAdmin(user.role)
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "parceiros" && canSeePartnerTickets ? "parceiros" : "interna"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415] flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-[#F58220]" /> Comunicação
        </h1>
        <p className="text-gray-600 mt-1 text-sm">Comunicações internas da equipe, chamados de parceiros e suporte com a Tribuss.</p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="interna" className="flex-shrink-0">Interna</TabsTrigger>
          {canSeePartnerTickets && (
            <TabsTrigger value="parceiros" className="flex-shrink-0">
              <Handshake className="h-3.5 w-3.5 mr-1" /> Parceiros
            </TabsTrigger>
          )}
          <TabsTrigger value="suporte" className="flex-shrink-0">
            <LifeBuoy className="h-3.5 w-3.5 mr-1" /> Suporte Tribuss
          </TabsTrigger>
          {isMaster && (
            <TabsTrigger value="auditoria" className="flex-shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Auditoria
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="interna" className="mt-4">
          <InternalCommunications />
        </TabsContent>
        {canSeePartnerTickets && (
          <TabsContent value="parceiros" className="mt-4">
            <PartnerTicketsInbox />
          </TabsContent>
        )}
        <TabsContent value="suporte" className="mt-4">
          <TicketsPanel basePath="/api/company/tickets" />
        </TabsContent>
        {isMaster && (
          <TabsContent value="auditoria" className="mt-4">
            <AuditTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function InternalCommunications() {
  const user = useCompanyUser()
  const isMaster = isCompanyMasterOrAdmin(user.role)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<"enviadas" | "PENDING_RESPONSE" | "RESPONDED" | "CONCLUDED">("PENDING_RESPONSE")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Message | null>(null)

  const reload = () => {
    setIsLoading(true)
    const params = tab === "enviadas" ? "mine=1" : `status=${tab}`
    adminFetch<Message[]>(`/api/company/communications?${params}`)
      .then(setMessages)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [tab])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-1" /> Nova Mensagem
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="enviadas" className="flex-shrink-0">Enviadas{isMaster ? " (minhas)" : ""}</TabsTrigger>
          <TabsTrigger value="PENDING_RESPONSE" className="flex-shrink-0">Pendentes de Resposta</TabsTrigger>
          <TabsTrigger value="RESPONDED" className="flex-shrink-0">Respondidas</TabsTrigger>
          <TabsTrigger value="CONCLUDED" className="flex-shrink-0">Concluídas</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {isLoading ? (
            <LoadingState />
          ) : messages.length === 0 ? (
            <EmptyState message="Nenhuma comunicação aqui." />
          ) : (
            <div className="grid gap-2">
              {messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[#3E2415] text-sm truncate">{m.subject}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[m.status]}`}>{STATUS_LABELS[m.status]}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      De {m.sender.name} · {recipientLabel(m)} · {m._count.replies} resposta(s)
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(m.updatedAt).toLocaleDateString("pt-BR")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Tabs>

      {isCreateOpen && (
        <NewMessageDialog
          onClose={() => setIsCreateOpen(false)}
          onSent={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
      {selected && (
        <MessageThreadDialog
          messageId={selected.id}
          isMaster={isMaster}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}

const ALL_STATUSES: MessageStatus[] = ["SENT", "PENDING_RESPONSE", "RESPONDED", "CONCLUDED"]

/** Auditoria geral do Master — todas as comunicações internas da empresa, com filtros por Colaborador/Setor/Status/Período. */
function AuditTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sectors, setSectors] = useState<Sector[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState("ALL")
  const [sectorId, setSectorId] = useState("ALL")
  const [status, setStatus] = useState("ALL")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selected, setSelected] = useState<Message | null>(null)

  useEffect(() => {
    adminFetch<Sector[]>("/api/company/sectors").then(setSectors)
    adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
  }, [])

  const reload = () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (employeeId !== "ALL") params.set("employeeId", employeeId)
    if (sectorId !== "ALL") params.set("sectorId", sectorId)
    if (status !== "ALL") params.set("status", status)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    adminFetch<Message[]>(`/api/company/communications?${params.toString()}`)
      .then(setMessages)
      .finally(() => setIsLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [employeeId, sectorId, status, startDate, endDate])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Colaborador</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Setor</Label>
          <Select value={sectorId} onValueChange={setSectorId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Período</Label>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : messages.length === 0 ? (
        <EmptyState message="Nenhuma comunicação encontrada para esses filtros." />
      ) : (
        <div className="grid gap-2">
          {messages.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-[#3E2415] text-sm truncate">{m.subject}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[m.status]}`}>{STATUS_LABELS[m.status]}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  De {m.sender.name} · {recipientLabel(m)} · {m._count.replies} resposta(s)
                </p>
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(m.updatedAt).toLocaleDateString("pt-BR")}</span>
            </button>
          ))}
        </div>
      )}

      {selected && <MessageThreadDialog messageId={selected.id} isMaster onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  )
}

function NewMessageDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [recipientType, setRecipientType] = useState<RecipientType>("SECTOR")
  const [recipientSectorId, setRecipientSectorId] = useState("")
  const [recipientRole, setRecipientRole] = useState("COMPANY_GERENTE")
  const [recipientEmployeeId, setRecipientEmployeeId] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<Sector[]>("/api/company/sectors").then(setSectors)
    adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (recipientType === "SECTOR" && !recipientSectorId) {
      setError("Selecione o setor")
      return
    }
    if (recipientType === "EMPLOYEE" && !recipientEmployeeId) {
      setError("Selecione o colaborador")
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("recipientType", recipientType)
      if (recipientType === "SECTOR") formData.append("recipientSectorId", recipientSectorId)
      if (recipientType === "ROLE") formData.append("recipientRole", recipientRole)
      if (recipientType === "EMPLOYEE") formData.append("recipientEmployeeId", recipientEmployeeId)
      formData.append("subject", subject)
      formData.append("body", body)
      files.forEach((f) => formData.append("files", f))

      await adminFetch("/api/company/communications", { method: "POST", body: formData })
      onSent()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao enviar mensagem")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Comunicação Interna</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-2">
            <Label>Para</Label>
            <Select value={recipientType} onValueChange={(v) => setRecipientType(v as RecipientType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SECTOR">Setor</SelectItem>
                <SelectItem value="ROLE">Função</SelectItem>
                <SelectItem value="EMPLOYEE">Colaborador Específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recipientType === "SECTOR" && (
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={recipientSectorId} onValueChange={setRecipientSectorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400">Entregue aos colaboradores marcados como responsáveis pelo setor.</p>
            </div>
          )}
          {recipientType === "ROLE" && (
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={recipientRole} onValueChange={setRecipientRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {recipientType === "EMPLOYEE" && (
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={recipientEmployeeId} onValueChange={setRecipientEmployeeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Mensagem</Label>
            <RichTextEditor value={body} onChange={setBody} placeholder="Escreva a comunicação..." />
          </div>

          <div className="space-y-2">
            <Label>Anexos (opcional, até 5 arquivos)</Label>
            <Input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && <p className="text-xs text-gray-500">{files.length} arquivo(s) selecionado(s)</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              <Send className="h-4 w-4 mr-1" /> Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MessageThreadDialog({
  messageId,
  isMaster,
  onClose,
  onChanged,
}: {
  messageId: string
  isMaster: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [message, setMessage] = useState<MessageDetail | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const reload = () => {
    adminFetch<MessageDetail>(`/api/company/communications/${messageId}`).then(setMessage)
  }
  useEffect(reload, [messageId])

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/communications/${messageId}/reply`, { method: "POST", body: JSON.stringify({ body: replyBody }) })
      setReplyBody("")
      reload()
      onChanged()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao responder")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConclude = async () => {
    await adminFetch(`/api/company/communications/${messageId}`, { method: "PATCH", body: JSON.stringify({ status: "CONCLUDED" }) }).catch(() => {})
    reload()
    onChanged()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {!message ? (
          <LoadingState />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{message.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                <span className={`font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[message.status]}`}>{STATUS_LABELS[message.status]}</span>
                <span>De {message.sender.name}</span>
                <span>· {recipientLabel(message)}</span>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-sm text-[#3E2415]" dangerouslySetInnerHTML={{ __html: message.body }} />

              {message.attachmentUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.attachmentUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#F58220] underline"
                    >
                      <Paperclip className="h-3 w-3" /> Anexo
                    </a>
                  ))}
                </div>
              )}

              {message.replies.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {message.replies.map((r) => (
                    <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-xs font-medium text-[#3E2415]">{r.author.name}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{r.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                  ))}
                </div>
              )}

              {message.status !== "CONCLUDED" && (
                <form onSubmit={handleReply} className="space-y-2 pt-2 border-t border-gray-100">
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Escreva uma resposta..." />
                  <div className="flex items-center justify-between gap-2">
                    <Button type="submit" size="sm" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                      <Send className="h-3.5 w-3.5 mr-1" /> Responder
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={handleConclude}>
                      Marcar como Concluída
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
