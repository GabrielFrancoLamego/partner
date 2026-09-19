"use client"

import { useEffect, useState } from "react"
import { Plus, Power, Trash2, Pencil, Check, X, Camera, Undo2, PartyPopper, RefreshCcw, HandHelping, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard, MobileCardAction } from "@/components/admin/mobile-card"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"
import { resolveChecklistUrgency, CHECKLIST_URGENCY_CLASSES, CHECKLIST_URGENCY_TEXT_CLASSES } from "@/lib/checklist-urgency"
import { useSearchParams, useRouter } from "next/navigation"

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  FORTNIGHTLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  TRIMONTHLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

type Employee = { id: string; name: string }

type Template = {
  id: string
  title: string
  description: string | null
  recurrence: string
  recurrenceDayOfWeek: number | null
  recurrenceDayOfMonth: number | null
  recurrenceAnchorMonth: number | null
  priority: string
  dueTime: string
  requiresPhoto: boolean
  active: boolean
  unit: { id: string; name: string } | null
  primaryEmployee: Employee | null
  secondaryEmployee: Employee | null
  _count: { instances: number }
}

type ChecklistInstance = {
  id: string
  title: string
  notes: string | null
  photoUrl: string | null
  priority: string
  status: string
  dueAt: string | null
  forDate: string
  createdAt: string
  isAutoReassigned: boolean
  isExtraTask: boolean
  rejectionReason: string | null
  employee: { id: string; name: string; role: string }
  template: { id: string; title: string; requiresPhoto: boolean } | null
}

/**
 * Modo fullscreen (?fullscreen=1) — atalho do menu do colaborador no mobile
 * abre aqui direto (ver company-shell.tsx). `fixed inset-0` cobre a sidebar/
 * topbar do shell só em telas pequenas; em desktop (`lg:`) volta a ser um
 * bloco normal dentro do layout.
 */
export default function CompanyChecklistsPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)
  const searchParams = useSearchParams()
  const router = useRouter()
  const isFullscreen = searchParams.get("fullscreen") === "1"

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Checklists Operacionais</h1>
          <p className="text-gray-600 mt-1 text-sm">Tarefas por turno com comprovação fotográfica</p>
        </div>
        {isFullscreen && (
          <Button variant="outline" size="sm" onClick={() => router.replace("/company/checklists")} className="flex-shrink-0">
            <Minimize2 className="h-4 w-4 mr-1" /> Sair da tela cheia
          </Button>
        )}
      </div>

      {isManager ? <ManagerView /> : <EmployeeView />}
    </div>
  )

  if (!isFullscreen) return content

  return <div className="fixed inset-0 z-[60] bg-[#F7F5F2] overflow-y-auto p-4 pb-10 lg:static lg:z-auto lg:bg-transparent lg:p-0">{content}</div>
}

function EfficiencyBar({ percent, onCelebrationSeen }: { percent: number; onCelebrationSeen: () => void }) {
  const [showCelebration, setShowCelebration] = useState(false)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    if (percent >= 100 && !seen) {
      setShowCelebration(true)
      setSeen(true)
    }
  }, [percent, seen])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">Eficiência do dia</span>
        <span className="font-bold text-[#3E2415]">{percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      {showCelebration && (
        <Dialog open onOpenChange={() => setShowCelebration(false)}>
          <DialogContent className="text-center">
            <div className="py-6 space-y-3">
              <PartyPopper className="h-12 w-12 text-[#FB9C08] mx-auto animate-bounce" />
              <p className="text-lg font-bold text-[#3E2415]">100% concluído hoje!</p>
              <p className="text-sm text-gray-500">+5 XP · Medalha do dia conquistada 🎉</p>
              <Button
                onClick={() => {
                  setShowCelebration(false)
                  onCelebrationSeen()
                }}
                className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

type VolunteerOpportunity = {
  templateId: string
  title: string
  dueTime: string
  requiresPhoto: boolean
  primaryEmployee: { id: string; name: string }
}

function EmployeeView() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [opportunities, setOpportunities] = useState<VolunteerOpportunity[]>([])
  const [efficiency, setEfficiency] = useState<{ total: number; approved: number; percent: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [executing, setExecuting] = useState<Template | "custom" | null>(null)
  const [submitting, setSubmitting] = useState<ChecklistInstance | null>(null)
  const [markingNotExecuted, setMarkingNotExecuted] = useState<ChecklistInstance | null>(null)
  const [volunteering, setVolunteering] = useState<string | null>(null)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<Template[]>("/api/company/checklists/templates"),
      adminFetch<{ checklists: ChecklistInstance[]; efficiency: typeof efficiency }>("/api/company/checklists"),
      adminFetch<VolunteerOpportunity[]>("/api/company/checklists/volunteer"),
    ])
      .then(([t, res, vol]) => {
        setTemplates(t)
        setInstances(res.checklists)
        setEfficiency(res.efficiency)
        setOpportunities(vol)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleVolunteer = async (templateId: string) => {
    setVolunteering(templateId)
    try {
      await adminFetch("/api/company/checklists/volunteer", { method: "POST", body: JSON.stringify({ templateId }) })
      reload()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao se voluntariar")
    } finally {
      setVolunteering(null)
    }
  }

  if (isLoading) return <LoadingState />

  const pending = instances.filter((i) => i.status === "PENDING")
  const awaitingReview = instances.filter((i) => i.status === "SUBMITTED")
  const finished = instances.filter((i) => ["APPROVED", "REJECTED"].includes(i.status)).slice(0, 20)
  const freeTemplates = templates.filter((t) => !t.primaryEmployee)

  return (
    <div className="space-y-6">
      {efficiency && efficiency.total > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <EfficiencyBar percent={efficiency.percent} onCelebrationSeen={reload} />
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-[#3E2415]">Minhas tarefas de hoje</h4>
          <div className="grid gap-2">
            {pending.map((i) => {
              const urgency = resolveChecklistUrgency(i.dueAt)
              return (
                <div key={i.id} className={`p-3 rounded-xl border ${CHECKLIST_URGENCY_CLASSES[urgency]}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                    <StatusBadge status={i.priority} />
                    {i.isAutoReassigned && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                        Reatribuída a você
                      </span>
                    )}
                    {i.isExtraTask && (
                      <span className="text-[10px] font-medium text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">
                        Tarefa Extra
                      </span>
                    )}
                    {urgency === "OVERDUE" && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5">Atrasada</span>
                    )}
                    {urgency === "SOON" && (
                      <span className="text-[10px] font-bold text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">Quase no limite</span>
                    )}
                  </div>
                  {i.dueAt && (
                    <p className={`text-xs mt-0.5 ${CHECKLIST_URGENCY_TEXT_CLASSES[urgency]}`}>
                      Prazo: {new Date(i.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button size="sm" variant="outline" disabled className="text-xs">
                      Em andamento
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSubmitting(i)}
                      className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white text-xs"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1" /> Concluído
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMarkingNotExecuted(i)} className="text-xs text-red-600 border-red-200">
                      Não executado
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-[#3E2415] flex items-center gap-1.5">
            <HandHelping className="h-4 w-4 text-[#F58220]" /> Tarefas que você pode ajudar
          </h4>
          <p className="text-xs text-gray-500 -mt-2">
            O responsável principal está presente hoje — ajudar conta como Tarefa Extra e bonifica sua eficiência.
          </p>
          <div className="grid gap-2">
            {opportunities.map((o) => (
              <div key={o.templateId} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-purple-100 bg-purple-50/50 flex-wrap">
                <div>
                  <p className="font-medium text-[#3E2415] text-sm">{o.title}</p>
                  <p className="text-xs text-gray-500">Principal: {o.primaryEmployee.name} · até às {o.dueTime}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={volunteering === o.templateId}
                  onClick={() => handleVolunteer(o.templateId)}
                  className="text-xs border-purple-200 text-purple-700 hover:bg-purple-100"
                >
                  <HandHelping className="h-3.5 w-3.5 mr-1" /> Ajudar nesta tarefa
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {awaitingReview.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-[#3E2415]">Aguardando aprovação da Gerente</h4>
          <div className="grid gap-2">
            {awaitingReview.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                <div>
                  <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                  <p className="text-xs text-gray-500">Entregue em {new Date(i.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <StatusBadge status={i.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-semibold text-[#3E2415]">Tarefas livres (sem responsável fixo)</h4>
        {freeTemplates.length === 0 ? (
          <EmptyState message="Nenhuma tarefa livre configurada." />
        ) : (
          <div className="grid gap-2">
            {freeTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                <div>
                  <p className="font-medium text-[#3E2415] text-sm">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {RECURRENCE_LABELS[t.recurrence]} até às {t.dueTime}
                  </p>
                </div>
                <Button size="sm" onClick={() => setExecuting(t)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                  <Camera className="h-4 w-4 mr-1" /> Executar
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => setExecuting("custom")}>
          <Plus className="h-4 w-4 mr-1" /> Registrar tarefa avulsa
        </Button>
      </div>

      {finished.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-[#3E2415]">Histórico recente</h4>
          <div className="grid gap-2">
            {finished.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                <div>
                  <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                  <p className="text-xs text-gray-500">{new Date(i.createdAt).toLocaleString("pt-BR")}</p>
                  {i.rejectionReason && <p className="text-xs text-red-500 mt-0.5">{i.rejectionReason}</p>}
                </div>
                <StatusBadge status={i.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {executing && (
        <ExecuteDialog
          template={executing === "custom" ? null : executing}
          onClose={() => setExecuting(null)}
          onDone={() => {
            setExecuting(null)
            reload()
          }}
        />
      )}

      {submitting && (
        <SubmitCompleteDialog
          checklist={submitting}
          onClose={() => setSubmitting(null)}
          onDone={() => {
            setSubmitting(null)
            reload()
          }}
        />
      )}

      {markingNotExecuted && (
        <SubmitNotExecutedDialog
          checklist={markingNotExecuted}
          onClose={() => setMarkingNotExecuted(null)}
          onDone={() => {
            setMarkingNotExecuted(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function SubmitCompleteDialog({ checklist, onClose, onDone }: { checklist: ChecklistInstance; onClose: () => void; onDone: () => void }) {
  const requiresPhoto = checklist.template?.requiresPhoto ?? true
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (requiresPhoto && !file) {
      setError("Foto de comprovação é obrigatória")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("action", "COMPLETE")
      if (notes) body.append("notes", notes)
      if (file) body.append("file", file)
      await adminFetch(`/api/company/checklists/${checklist.id}/submit`, { method: "POST", body })
      onDone()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao entregar tarefa")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir "{checklist.title}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{requiresPhoto ? "Foto de comprovação *" : "Foto (opcional)"}</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={requiresPhoto} />
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

function SubmitNotExecutedDialog({ checklist, onClose, onDone }: { checklist: ChecklistInstance; onClose: () => void; onDone: () => void }) {
  const [justification, setJustification] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!justification.trim()) {
      setError("Justifique por que a tarefa não foi executada")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("action", "NOT_EXECUTED")
      body.append("justification", justification)
      await adminFetch(`/api/company/checklists/${checklist.id}/submit`, { method: "POST", body })
      onDone()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Não executado: "{checklist.title}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Justificativa *</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
              Enviar justificativa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExecuteDialog({ template, onClose, onDone }: { template: Template | null; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(template?.title ?? "")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!file) {
      setError("Foto de comprovação é obrigatória")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      if (template) body.append("templateId", template.id)
      if (title) body.append("title", title)
      if (notes) body.append("notes", notes)
      body.append("file", file)
      await adminFetch("/api/company/checklists", { method: "POST", body })
      onDone()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? template.title : "Tarefa avulsa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!template && (
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Foto de comprovação *</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
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

function ManagerView() {
  return (
    <Tabs defaultValue="master">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="master">Checklist Master</TabsTrigger>
        <TabsTrigger value="templates">Tarefas Recorrentes</TabsTrigger>
        <TabsTrigger value="review">Aprovações</TabsTrigger>
      </TabsList>
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
        <TabsContent value="master">
          <MasterTab />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="review">
          <ReviewTab />
        </TabsContent>
      </div>
    </Tabs>
  )
}

/** Visão consolidada de TODAS as tarefas de hoje da empresa — quem é o responsável atual, prazo e status em tempo real. */
function MasterTab() {
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<{ checklists: ChecklistInstance[] }>("/api/company/checklists?scope=team")
      .then((res) => setInstances(res.checklists))
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  if (isLoading) return <LoadingState />

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todays = instances.filter((i) => new Date(i.forDate).getTime() === today.getTime())

  if (todays.length === 0) return <EmptyState message="Nenhuma tarefa atribuída para hoje." />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
      </div>
      <div className="grid gap-2">
        {todays.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                <StatusBadge status={i.status} />
                {i.isAutoReassigned && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                    Reatribuída
                  </span>
                )}
                {i.isExtraTask && (
                  <span className="text-[10px] font-medium text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">
                    Tarefa Extra
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Responsável: {i.employee.name}
                {i.dueAt && ` · Prazo: ${new Date(i.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<Template[]>("/api/company/checklists/templates"),
      adminFetch<Employee[]>("/api/company/employees"),
    ])
      .then(([t, e]) => {
        setTemplates(t)
        setEmployees(e)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleToggle = async (t: Template) => {
    await adminFetch(`/api/company/checklists/templates/${t.id}`, { method: "PATCH", body: JSON.stringify({ active: !t.active }) })
    reload()
  }

  const handleDelete = async (t: Template) => {
    if (!confirm(`Excluir "${t.title}"?`)) return
    await adminFetch(`/api/company/checklists/templates/${t.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
        </Button>
      </div>
      {templates.length === 0 ? (
        <EmptyState message="Nenhuma tarefa recorrente criada ainda." />
      ) : (
        <div className="grid gap-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-[#3E2415] text-sm">{t.title}</p>
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {RECURRENCE_LABELS[t.recurrence]}
                  {t.recurrenceDayOfWeek != null && ` · ${WEEKDAY_LABELS[t.recurrenceDayOfWeek]}`}
                  {t.recurrenceDayOfMonth != null && ` · dia ${t.recurrenceDayOfMonth === -1 ? "último" : t.recurrenceDayOfMonth}`}
                  {["BIMONTHLY", "TRIMONTHLY", "SEMIANNUAL", "ANNUAL"].includes(t.recurrence) &&
                    ` · a partir de ${MONTH_LABELS[t.recurrenceAnchorMonth ?? 0]}`}
                  {" "}até às {t.dueTime} · {t._count.instances} execuções
                </p>
                <p className="text-xs text-gray-500">
                  Principal: {t.primaryEmployee?.name ?? "livre (qualquer colaborador)"}
                  {t.secondaryEmployee && ` · Secundário: ${t.secondaryEmployee.name}`}
                  {!t.requiresPhoto && " · sem exigência de foto"}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => setEditing(t)} title="Editar tarefa">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleToggle(t)} title={t.active ? "Inativar" : "Ativar"}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} className="text-red-600" title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isCreateOpen && (
        <TemplateDialog
          employees={employees}
          onClose={() => setIsCreateOpen(false)}
          onSaved={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
      {editing && (
        <TemplateDialog
          template={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function TemplateDialog({
  template,
  employees,
  onClose,
  onSaved,
}: {
  template?: Template
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(template?.title ?? "")
  const [description, setDescription] = useState(template?.description ?? "")
  const [recurrence, setRecurrence] = useState(template?.recurrence ?? "DAILY")
  const [dayOfWeek, setDayOfWeek] = useState<string>(template?.recurrenceDayOfWeek != null ? String(template.recurrenceDayOfWeek) : "none")
  const [dayOfMonth, setDayOfMonth] = useState<string>(template?.recurrenceDayOfMonth != null ? String(template.recurrenceDayOfMonth) : "none")
  const [anchorMonth, setAnchorMonth] = useState<string>(template?.recurrenceAnchorMonth != null ? String(template.recurrenceAnchorMonth) : "0")
  const [priority, setPriority] = useState(template?.priority ?? "MEDIUM")
  const [dueTime, setDueTime] = useState(template?.dueTime ?? "18:00")
  const [requiresPhoto, setRequiresPhoto] = useState(template?.requiresPhoto ?? true)
  const [primaryEmployeeId, setPrimaryEmployeeId] = useState<string>(template?.primaryEmployee?.id ?? "none")
  const [secondaryEmployeeId, setSecondaryEmployeeId] = useState<string>(template?.secondaryEmployee?.id ?? "none")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showWeekday = recurrence === "WEEKLY" || recurrence === "FORTNIGHTLY"
  const showMonthDay = ["MONTHLY", "BIMONTHLY", "TRIMONTHLY", "SEMIANNUAL", "ANNUAL"].includes(recurrence)
  const showAnchorMonth = ["BIMONTHLY", "TRIMONTHLY", "SEMIANNUAL", "ANNUAL"].includes(recurrence)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const payload = {
        title,
        description,
        recurrence,
        recurrenceDayOfWeek: showWeekday && dayOfWeek !== "none" ? Number(dayOfWeek) : null,
        recurrenceDayOfMonth: showMonthDay && dayOfMonth !== "none" ? Number(dayOfMonth) : null,
        recurrenceAnchorMonth: showAnchorMonth ? Number(anchorMonth) : null,
        priority,
        dueTime,
        requiresPhoto,
        primaryEmployeeId: primaryEmployeeId !== "none" ? primaryEmployeeId : null,
        secondaryEmployeeId: secondaryEmployeeId !== "none" ? secondaryEmployeeId : null,
      }
      if (template) {
        await adminFetch(`/api/company/checklists/templates/${template.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      } else {
        await adminFetch("/api/company/checklists/templates", { method: "POST", body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar tarefa")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? `Editar "${template.title}"` : "Nova Tarefa Recorrente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showWeekday && (
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer dia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Qualquer dia</SelectItem>
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showMonthDay && (
            <div className="space-y-2">
              <Label>Dia do mês</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer dia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Qualquer dia</SelectItem>
                  <SelectItem value="-1">Último dia do mês</SelectItem>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Dia {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showAnchorMonth && (
            <div className="space-y-2">
              <Label>Mês de início/âncora</Label>
              <Select value={anchorMonth} onValueChange={setAnchorMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((label, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                Define a partir de qual mês o ciclo passa a se repetir (ex: trimestral a partir de fevereiro = fev/mai/ago/nov).
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Horário limite diário</Label>
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} required />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox checked={requiresPhoto} onCheckedChange={(v) => setRequiresPhoto(v === true)} />
            Exige foto de comprovação na entrega
          </label>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Responsáveis (opcional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Principal</Label>
                <Select value={primaryEmployeeId} onValueChange={setPrimaryEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Livre (qualquer colaborador)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Livre (qualquer colaborador)</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secundário</Label>
                <Select value={secondaryEmployeeId} onValueChange={setSecondaryEmployeeId} disabled={primaryEmployeeId === "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {employees.filter((e) => e.id !== primaryEmployeeId).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Com principal definido, a tarefa é atribuída automaticamente todo dia. Se ele faltar (sem check-in ou
              inativo), cai no secundário; se os dois faltarem, cai no Checklist Master da Gerente.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              {template ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Double-check: Aprovar / Devolver / Não entregue (com justificativa) das tarefas entregues pelos colaboradores. */
function ReviewTab() {
  const user = useCompanyUser()
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [returning, setReturning] = useState<ChecklistInstance | null>(null)
  const [rejecting, setRejecting] = useState<ChecklistInstance | null>(null)

  // Tarefa escalada para a própria Gerente só pode ser avaliada pelo Master (ver app/api/company/checklists/[id]).
  const canReview = (i: ChecklistInstance) => !(user.role === "COMPANY_GERENTE" && i.employee.role === "COMPANY_GERENTE")

  const reload = () => {
    setIsLoading(true)
    adminFetch<{ checklists: ChecklistInstance[] }>("/api/company/checklists?scope=team&status=SUBMITTED")
      .then((res) => setInstances(res.checklists))
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleApprove = async (i: ChecklistInstance) => {
    await adminFetch(`/api/company/checklists/${i.id}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }).catch(
      (e) => alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />
  if (instances.length === 0) return <EmptyState message="Nenhuma entrega aguardando aprovação." />

  return (
    <>
      <MobileCardList>
        {instances.map((i) => (
          <MobileCard
            key={i.id}
            title={i.title}
            subtitle={i.employee.name}
            badges={<StatusBadge status={i.status} />}
            fields={[
              ...(i.rejectionReason ? [{ label: "Obs. do colaborador", value: i.rejectionReason }] : []),
              { label: "Foto", value: i.photoUrl ? "Anexada" : "—" },
            ]}
            actions={
              <>
                {i.photoUrl && (
                  <a href={i.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] underline">
                    Ver foto
                  </a>
                )}
                {canReview(i) ? (
                  <>
                    <MobileCardAction icon={Check} label="Aprovar" onClick={() => handleApprove(i)} />
                    <MobileCardAction icon={Undo2} label="Devolver" onClick={() => setReturning(i)} />
                    <MobileCardAction icon={X} label="Não entregue" tone="danger" onClick={() => setRejecting(i)} />
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Só o Master avalia</span>
                )}
              </>
            }
          />
        ))}
      </MobileCardList>

      <TableDesktop>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tarefa</th>
              <th className="px-4 py-3 font-medium">Colaborador</th>
              <th className="px-4 py-3 font-medium">Foto</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {instances.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-[#3E2415] font-medium">
                  {i.title}
                  {i.rejectionReason && <p className="text-xs text-gray-500 font-normal mt-0.5">{i.rejectionReason}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{i.employee.name}</td>
                <td className="px-4 py-3">
                  {i.photoUrl ? (
                    <a href={i.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] hover:underline">
                      Ver foto
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={i.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {canReview(i) ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleApprove(i)} title="Aprovar">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-amber-600" onClick={() => setReturning(i)} title="Devolver">
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setRejecting(i)} title="Não entregue">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Só o Master avalia</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableDesktop>

      {returning && (
        <ReviewNoteDialog
          checklist={returning}
          title="Devolver tarefa"
          confirmLabel="Devolver"
          status="RETURNED"
          onClose={() => setReturning(null)}
          onDone={() => {
            setReturning(null)
            reload()
          }}
        />
      )}
      {rejecting && (
        <ReviewNoteDialog
          checklist={rejecting}
          title="Marcar como não entregue"
          confirmLabel="Confirmar"
          status="REJECTED"
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function ReviewNoteDialog({
  checklist,
  title,
  confirmLabel,
  status,
  onClose,
  onDone,
}: {
  checklist: ChecklistInstance
  title: string
  confirmLabel: string
  status: "RETURNED" | "REJECTED"
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!note.trim()) {
      setError("Descreva o motivo")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/checklists/${checklist.id}`, { method: "PATCH", body: JSON.stringify({ status, note }) })
      onDone()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title}: "{checklist.title}"
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Limpeza incompleta, refazer" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={status === "REJECTED" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
