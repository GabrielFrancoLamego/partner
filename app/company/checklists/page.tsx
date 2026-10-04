"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Power,
  Trash2,
  Pencil,
  Check,
  X,
  Camera,
  Undo2,
  PartyPopper,
  RefreshCcw,
  HandHelping,
  Minimize2,
  HandMetal,
  ChevronRight,
  History,
  Filter,
  RotateCcw,
} from "lucide-react"
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
import {
  resolveChecklistUrgency,
  resolveChecklistDisplayState,
  CHECKLIST_URGENCY_CLASSES,
  CHECKLIST_URGENCY_TEXT_CLASSES,
  CHECKLIST_DISPLAY_CLASSES,
  CHECKLIST_DISPLAY_TEXT_CLASSES,
  sortChecklists,
} from "@/lib/checklist-urgency"
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

const ASSIGNMENT_LABELS: Record<string, string> = {
  SPECIFIC: "Colaborador Específico",
  FREE: "Livre (Qualquer Colaborador)",
  SECTOR: "Por Setor",
  TAG: "Por Tag",
}

type Employee = { id: string; name: string }
type Sector = { id: string; name: string }

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
  requiresApproval: boolean
  active: boolean
  instructionPhotoUrl: string | null
  instructionVideoUrl: string | null
  unit: { id: string; name: string } | null
  assignmentType: "SPECIFIC" | "FREE" | "SECTOR" | "TAG"
  primaryEmployee: Employee | null
  secondaryEmployee: Employee | null
  targetSector: Sector | null
  targetTag: string | null
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
  approvedAt: string | null
  isAutoReassigned: boolean
  isExtraTask: boolean
  claimedAt: string | null
  requiresApproval: boolean
  rejectionReason: string | null
  employee: { id: string; name: string; role: string; employeeProfile: { sectorId: string | null } | null } | null
  template: {
    id: string
    title: string
    requiresPhoto: boolean
    recurrence?: string
    instructionPhotoUrl?: string | null
    instructionVideoUrl?: string | null
  } | null
}

type PreviewRow = {
  id: string
  title: string
  notes: string | null
  priority: string
  dueAt: string
  forDate: string
  isPreview: true
  destination: string
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

      {isManager ? <ManagerView /> : <PersonalChecklistView />}
    </div>
  )

  if (!isFullscreen) return content

  // z-50 (não z-[60]) de propósito: precisa cobrir a barra/sidebar do shell
  // (também z-50, mas antes no DOM — a ordem decide o empate), mas sem ficar
  // acima dos Dialog/Select/Popover do Radix (portal pro body, também z-50,
  // porém depois no DOM) — com z-[60] esses diálogos abriam "atrás" da tela
  // cheia, invisíveis mas ainda capturando clique: parecia a navegação travada.
  return <div className="fixed inset-0 z-50 bg-[#F7F5F2] overflow-y-auto p-4 pb-10 lg:static lg:z-auto lg:bg-transparent lg:p-0">{content}</div>
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

/** Aba 1 "Checklist do Dia" — tarefas do próprio usuário logado, inclusive pra Gerente/Master (ver ManagerView). */
function PersonalChecklistView() {
  const user = useCompanyUser()
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [opportunities, setOpportunities] = useState<VolunteerOpportunity[]>([])
  const [efficiency, setEfficiency] = useState<{ total: number; approved: number; percent: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingAdhoc, setIsCreatingAdhoc] = useState(false)
  const [submitting, setSubmitting] = useState<ChecklistInstance | null>(null)
  const [viewingInfo, setViewingInfo] = useState<ChecklistInstance | null>(null)
  const [volunteering, setVolunteering] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [quickCompleting, setQuickCompleting] = useState<string | null>(null)
  const [error, setError] = useState("")

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<{ checklists: ChecklistInstance[]; efficiency: typeof efficiency }>("/api/company/checklists"),
      adminFetch<VolunteerOpportunity[]>("/api/company/checklists/volunteer"),
    ])
      .then(([res, vol]) => {
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

  const handleQuickComplete = async (checklist: ChecklistInstance) => {
    setError("")
    setQuickCompleting(checklist.id)
    try {
      const body = new FormData()
      body.append("action", "COMPLETE")
      await adminFetch(`/api/company/checklists/${checklist.id}/submit`, { method: "POST", body })
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao concluir tarefa")
      setTimeout(() => setError(""), 4000)
    } finally {
      setQuickCompleting(null)
    }
  }

  const handleClaim = async (checklistId: string) => {
    setError("")
    setClaiming(checklistId)
    try {
      await adminFetch(`/api/company/checklists/${checklistId}/claim`, { method: "POST" })
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao reservar tarefa")
      setTimeout(() => setError(""), 4000)
    } finally {
      setClaiming(null)
    }
  }

  if (isLoading) return <LoadingState />

  const pending = instances.filter((i) => i.status === "PENDING")
  const myPending = sortChecklists(pending.filter((i) => i.employee))
  const claimable = sortChecklists(pending.filter((i) => !i.employee))
  const awaitingReview = instances.filter((i) => i.status === "SUBMITTED")
  const finished = instances.filter((i) => ["APPROVED", "REJECTED"].includes(i.status)).slice(0, 20)

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

      {efficiency && efficiency.total > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <EfficiencyBar percent={efficiency.percent} onCelebrationSeen={reload} />
        </div>
      )}

      {myPending.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-[#3E2415]">Minhas tarefas de hoje</h4>
          <div className="grid gap-2">
            {myPending.map((i) => {
              const urgency = resolveChecklistUrgency(i.dueAt)
              return (
                <div key={i.id} className={`p-3 rounded-xl border ${CHECKLIST_URGENCY_CLASSES[urgency]}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => setViewingInfo(i)} className="font-medium text-[#3E2415] text-sm underline decoration-dotted text-left">
                      {i.title}
                    </button>
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
                    {i.claimedAt && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">Reservada por você</span>
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
                    {(i.template?.requiresPhoto ?? true) ? (
                      <Button
                        size="sm"
                        onClick={() => setSubmitting(i)}
                        className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white text-xs font-bold"
                      >
                        <Camera className="h-3.5 w-3.5 mr-1" /> Concluir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={quickCompleting === i.id}
                        onClick={() => handleQuickComplete(i)}
                        className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white text-xs font-bold"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Concluir
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {claimable.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-[#3E2415] flex items-center gap-1.5">
            <HandMetal className="h-4 w-4 text-[#F58220]" /> Tarefas disponíveis — reserve a sua
          </h4>
          <p className="text-xs text-gray-500 -mt-2">O primeiro a clicar "Vou Fazer" reserva a tarefa — ela some da tela dos outros.</p>
          <div className="grid gap-2">
            {claimable.map((i) => {
              const urgency = resolveChecklistUrgency(i.dueAt)
              return (
                <div key={i.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border flex-wrap ${CHECKLIST_URGENCY_CLASSES[urgency]}`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                      <StatusBadge status={i.priority} />
                    </div>
                    {i.dueAt && (
                      <p className={`text-xs mt-0.5 ${CHECKLIST_URGENCY_TEXT_CLASSES[urgency]}`}>
                        Até às {new Date(i.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={claiming === i.id}
                    onClick={() => handleClaim(i.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                  >
                    <HandMetal className="h-3.5 w-3.5 mr-1" /> Vou Fazer
                  </Button>
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
        <Button variant="outline" size="sm" onClick={() => setIsCreatingAdhoc(true)}>
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

      {isCreatingAdhoc && (
        <ExecuteDialog
          onClose={() => setIsCreatingAdhoc(false)}
          onDone={() => {
            setIsCreatingAdhoc(false)
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

      {viewingInfo && <TaskInfoDialog checklist={viewingInfo} onClose={() => setViewingInfo(null)} />}
    </div>
  )
}

/** Modal de instruções — abre ao clicar no título da tarefa, mostra a descrição e a mídia explicativa cadastrada no template (foto/vídeo), sem exigir nenhuma ação. */
function TaskInfoDialog({ checklist, onClose }: { checklist: ChecklistInstance; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{checklist.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {checklist.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{checklist.notes}</p>
          ) : (
            <p className="text-sm text-gray-400">Sem instruções detalhadas cadastradas.</p>
          )}
          {checklist.template?.instructionPhotoUrl && (
            <img src={checklist.template.instructionPhotoUrl} alt="Foto explicativa" className="w-full rounded-xl border border-gray-100" />
          )}
          {checklist.template?.instructionVideoUrl && (
            <video src={checklist.template.instructionVideoUrl} controls className="w-full rounded-xl border border-gray-100" />
          )}
        </div>
      </DialogContent>
    </Dialog>
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
          {!checklist.requiresApproval && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-2">
              Esta tarefa não exige aprovação do Gestor — ao enviar, já conta como concluída.
            </p>
          )}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{requiresPhoto ? "Foto de comprovação *" : "Foto (opcional)"}</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={requiresPhoto} />
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

/** Tarefa avulsa (sem template) — exige foto sempre, criada já SUBMITTED. */
function ExecuteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("")
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
          <DialogTitle>Tarefa avulsa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Foto de comprovação *</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
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

/**
 * 4 abas pra Gerente/Master: "Checklist do Dia" (tarefas do PRÓPRIO usuário,
 * igual ao colaborador — Gerente também pode ter tarefas SPECIFIC/escaladas),
 * "Todas as Tarefas / Equipe" (panorama da unidade com filtros rápidos de
 * status), "Aprovação de Tarefas" (fila exclusiva do que exige aprovação) e
 * "Tarefas Recorrentes" (cadastro dos templates — não pedido explicitamente
 * nesta reorganização, mas é a única forma de criar/editar tarefa).
 */
function ManagerView() {
  const [tab, setTab] = useState("mine")
  const [createSignal, setCreateSignal] = useState(0)

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <TabsTrigger value="mine" className="flex-shrink-0">Checklist do Dia</TabsTrigger>
        <TabsTrigger value="all" className="flex-shrink-0">Todas as Tarefas / Equipe</TabsTrigger>
        <TabsTrigger value="review" className="flex-shrink-0">Aprovação de Tarefas</TabsTrigger>
        <TabsTrigger value="templates" className="flex-shrink-0">Tarefas Recorrentes</TabsTrigger>
      </TabsList>
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
        <TabsContent value="mine">
          <PersonalChecklistView />
        </TabsContent>
        <TabsContent value="all">
          <DayView
            onCreateTask={() => {
              setTab("templates")
              setCreateSignal((n) => n + 1)
            }}
          />
        </TabsContent>
        <TabsContent value="review">
          <ReviewTab />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab openCreateSignal={createSignal} />
        </TabsContent>
      </div>
    </Tabs>
  )
}

type ViewMode = "today" | "tomorrow" | "history"

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Visão consolidada das tarefas da empresa — Hoje (com ações), Amanhã (prévia só leitura) e Histórico Concluído. */
function DayView({ onCreateTask }: { onCreateTask: () => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>("today")
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reopening, setReopening] = useState<ChecklistInstance | null>(null)

  const [recurrenceFilter, setRecurrenceFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [search, setSearch] = useState("")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [sectorFilter, setSectorFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LATE" | "IN_PROGRESS" | "DONE">("ALL")

  const reload = () => {
    setIsLoading(true)
    const requests: Promise<unknown>[] = [
      adminFetch<Employee[]>("/api/company/employees"),
      adminFetch<Sector[]>("/api/company/sectors"),
    ]
    if (viewMode === "tomorrow") {
      const tomorrow = addDays(startOfDay(new Date()), 1).toISOString().slice(0, 10)
      requests.push(adminFetch<{ checklists: PreviewRow[] }>(`/api/company/checklists?scope=team&date=${tomorrow}`))
    } else {
      requests.push(adminFetch<{ checklists: ChecklistInstance[] }>("/api/company/checklists?scope=team"))
    }
    Promise.all(requests)
      .then(([e, s, res]) => {
        setEmployees(e as Employee[])
        setSectors(s as Sector[])
        if (viewMode === "tomorrow") setPreview((res as { checklists: PreviewRow[] }).checklists)
        else setInstances((res as { checklists: ChecklistInstance[] }).checklists)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [viewMode])

  const rows = useMemo(() => {
    const today = startOfDay(new Date()).getTime()
    let list = instances
    if (viewMode === "today") {
      list = list.filter((c) => new Date(c.forDate).getTime() === today)
    } else if (viewMode === "history") {
      list = list.filter((c) => new Date(c.forDate).getTime() < today && ["APPROVED", "REJECTED"].includes(c.status))
    }
    if (recurrenceFilter) list = list.filter((c) => c.template?.recurrence === recurrenceFilter)
    if (priorityFilter) list = list.filter((c) => c.priority === priorityFilter)
    if (search.trim()) list = list.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    if (employeeFilter) list = list.filter((c) => c.employee?.id === employeeFilter)
    if (sectorFilter) list = list.filter((c) => c.employee?.employeeProfile?.sectorId === sectorFilter)
    if (statusFilter !== "ALL") {
      const now = Date.now()
      list = list.filter((c) => {
        const isOverdue = c.status === "PENDING" && c.dueAt && new Date(c.dueAt).getTime() < now
        if (statusFilter === "LATE") return isOverdue
        if (statusFilter === "IN_PROGRESS") return (c.status === "PENDING" && !isOverdue) || c.status === "SUBMITTED"
        if (statusFilter === "DONE") return c.status === "APPROVED" || c.status === "REJECTED"
        return true
      })
    }
    return sortChecklists(list)
  }, [instances, viewMode, recurrenceFilter, priorityFilter, search, employeeFilter, sectorFilter, statusFilter])

  const previewRows = useMemo(() => {
    let list = preview
    if (priorityFilter) list = list.filter((c) => c.priority === priorityFilter)
    if (search.trim()) list = list.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    return sortChecklists(list)
  }, [preview, priorityFilter, search])

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <Button type="button" size="sm" variant="ghost" onClick={() => setViewMode("today")} className={viewMode === "today" ? "text-xs bg-white shadow-sm text-[#3E2415] font-semibold" : "text-xs text-gray-500"}>
            Hoje
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setViewMode("tomorrow")} className={viewMode === "tomorrow" ? "text-xs bg-white shadow-sm text-[#3E2415] font-semibold" : "text-xs text-gray-500"}>
            <ChevronRight className="h-3.5 w-3.5 mr-1" /> Amanhã
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setViewMode("history")} className={viewMode === "history" ? "text-xs bg-white shadow-sm text-[#3E2415] font-semibold" : "text-xs text-gray-500"}>
            <History className="h-3.5 w-3.5 mr-1" /> Histórico Concluído
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={onCreateTask} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {viewMode !== "tomorrow" && (
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              ["ALL", "Todas"],
              ["LATE", "Atrasadas"],
              ["IN_PROGRESS", "Em Andamento"],
              ["DONE", "Concluídas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === value ? "bg-[#3E2415] text-white border-[#3E2415]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
        <Filter className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 bg-white h-8 text-xs" />
        {viewMode !== "tomorrow" && (
          <>
            <Select value={recurrenceFilter || "ALL"} onValueChange={(v) => setRecurrenceFilter(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-36 bg-white h-8 text-xs">
                <SelectValue placeholder="Recorrência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toda recorrência</SelectItem>
                {Object.entries(RECURRENCE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={employeeFilter || "ALL"} onValueChange={(v) => setEmployeeFilter(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-40 bg-white h-8 text-xs">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todo colaborador</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectorFilter || "ALL"} onValueChange={(v) => setSectorFilter(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-36 bg-white h-8 text-xs">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todo setor</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Select value={priorityFilter || "ALL"} onValueChange={(v) => setPriorityFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-32 bg-white h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toda prioridade</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>
        {(recurrenceFilter || priorityFilter || search || employeeFilter || sectorFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-gray-500"
            onClick={() => {
              setRecurrenceFilter("")
              setPriorityFilter("")
              setSearch("")
              setEmployeeFilter("")
              setSectorFilter("")
            }}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {viewMode === "tomorrow" ? (
        previewRows.length === 0 ? (
          <EmptyState message="Nenhuma tarefa recorrente prevista para amanhã." />
        ) : (
          <div className="grid gap-2">
            {previewRows.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[#3E2415] text-sm">{p.title}</p>
                    <StatusBadge status={p.priority} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.destination} · até às {new Date(p.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">Prévia</span>
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <EmptyState message={viewMode === "history" ? "Nenhuma tarefa concluída em dias anteriores." : "Nenhuma tarefa atribuída para hoje."} />
      ) : (
        <div className="grid gap-2">
          {rows.map((i) => {
            const display = resolveChecklistDisplayState(i.status, i.dueAt)
            const isLate = i.status === "REJECTED" || (i.dueAt && i.approvedAt && new Date(i.approvedAt) > new Date(i.dueAt))
            return (
              <div key={i.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border flex-wrap ${CHECKLIST_DISPLAY_CLASSES[display]}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                    <StatusBadge status={i.status} />
                    <StatusBadge status={i.priority} />
                    {i.isAutoReassigned && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Reatribuída</span>
                    )}
                    {i.isExtraTask && (
                      <span className="text-[10px] font-medium text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">Tarefa Extra</span>
                    )}
                    {!i.requiresApproval && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">Sem aprovação</span>
                    )}
                    {viewMode === "history" && isLate && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5">Atrasada</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Responsável: {i.employee?.name ?? "Aguardando reserva (tarefa livre)"}
                    {i.dueAt && ` · Prazo: ${new Date(i.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
                {viewMode === "today" && i.status === "APPROVED" && (
                  <Button size="sm" variant="outline" className="text-xs text-amber-700 border-amber-200" onClick={() => setReopening(i)}>
                    <Undo2 className="h-3.5 w-3.5 mr-1" /> Recusar/Reabrir
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {reopening && (
        <ReviewNoteDialog
          checklist={reopening}
          title="Recusar/Reabrir tarefa concluída"
          confirmLabel="Reabrir"
          status="RETURNED"
          onClose={() => setReopening(null)}
          onDone={() => {
            setReopening(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function TemplatesTab({ openCreateSignal }: { openCreateSignal?: number }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  useEffect(() => {
    if (openCreateSignal) setIsCreateOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateSignal])

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<Template[]>("/api/company/checklists/templates"),
      adminFetch<Employee[]>("/api/company/employees"),
      adminFetch<Sector[]>("/api/company/sectors"),
    ])
      .then(([t, e, s]) => {
        setTemplates(t)
        setEmployees(e)
        setSectors(s)
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

  const destinationLabel = (t: Template) => {
    if (t.assignmentType === "SPECIFIC") return t.primaryEmployee?.name ?? "livre (qualquer colaborador)"
    if (t.assignmentType === "SECTOR") return `Setor: ${t.targetSector?.name ?? "—"}`
    if (t.assignmentType === "TAG") return `Tag: ${t.targetTag ?? "—"}`
    return "Livre (qualquer colaborador)"
  }

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
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{ASSIGNMENT_LABELS[t.assignmentType]}</span>
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
                  {destinationLabel(t)}
                  {t.assignmentType === "SPECIFIC" && t.secondaryEmployee && ` · Secundário: ${t.secondaryEmployee.name}`}
                  {!t.requiresPhoto && " · sem exigência de foto"}
                  {!t.requiresApproval && " · sem aprovação do gestor"}
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
          sectors={sectors}
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
          sectors={sectors}
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
  sectors,
  onClose,
  onSaved,
}: {
  template?: Template
  employees: Employee[]
  sectors: Sector[]
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
  const [requiresApproval, setRequiresApproval] = useState(template?.requiresApproval ?? true)
  const [assignmentType, setAssignmentType] = useState(template?.assignmentType ?? "SPECIFIC")
  const [primaryEmployeeId, setPrimaryEmployeeId] = useState<string>(template?.primaryEmployee?.id ?? "none")
  const [secondaryEmployeeId, setSecondaryEmployeeId] = useState<string>(template?.secondaryEmployee?.id ?? "none")
  const [targetSectorId, setTargetSectorId] = useState<string>(template?.targetSector?.id ?? "")
  const [targetTag, setTargetTag] = useState(template?.targetTag ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instructionPhotoUrl, setInstructionPhotoUrl] = useState(template?.instructionPhotoUrl ?? null)
  const [instructionVideoUrl, setInstructionVideoUrl] = useState(template?.instructionVideoUrl ?? null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  const handleMediaUpload = async (field: "photo" | "video", file: File) => {
    if (!template) return
    setIsUploadingMedia(true)
    try {
      const body = new FormData()
      body.append(field, file)
      const updated = await adminFetch<Template>(`/api/company/checklists/templates/${template.id}/media`, { method: "POST", body })
      setInstructionPhotoUrl(updated.instructionPhotoUrl)
      setInstructionVideoUrl(updated.instructionVideoUrl)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao enviar mídia")
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const showWeekday = recurrence === "WEEKLY" || recurrence === "FORTNIGHTLY"
  const showMonthDay = ["MONTHLY", "BIMONTHLY", "TRIMONTHLY", "SEMIANNUAL", "ANNUAL"].includes(recurrence)
  const showAnchorMonth = ["BIMONTHLY", "TRIMONTHLY", "SEMIANNUAL", "ANNUAL"].includes(recurrence)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (assignmentType === "SECTOR" && !targetSectorId) {
      setError("Selecione o setor de destino")
      return
    }
    if (assignmentType === "TAG" && !targetTag.trim()) {
      setError("Informe a tag de destino")
      return
    }
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
        requiresApproval,
        assignmentType,
        primaryEmployeeId: assignmentType === "SPECIFIC" && primaryEmployeeId !== "none" ? primaryEmployeeId : null,
        secondaryEmployeeId: assignmentType === "SPECIFIC" && secondaryEmployeeId !== "none" ? secondaryEmployeeId : null,
        targetSectorId: assignmentType === "SECTOR" ? targetSectorId : null,
        targetTag: assignmentType === "TAG" ? targetTag.trim() : null,
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

          {template && (
            <div className="space-y-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <Label className="text-xs">Foto/Vídeo explicativo (modal de instruções, opcional)</Label>
              <div className="flex flex-wrap gap-3">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    id="template-instruction-photo"
                    className="hidden"
                    disabled={isUploadingMedia}
                    onChange={(e) => e.target.files?.[0] && handleMediaUpload("photo", e.target.files[0])}
                  />
                  <label htmlFor="template-instruction-photo" className="text-xs cursor-pointer text-[#F58220] underline">
                    {instructionPhotoUrl ? "Trocar foto" : "Enviar foto"}
                  </label>
                  {instructionPhotoUrl && (
                    <a href={instructionPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 ml-2 underline">
                      Ver atual
                    </a>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime"
                    id="template-instruction-video"
                    className="hidden"
                    disabled={isUploadingMedia}
                    onChange={(e) => e.target.files?.[0] && handleMediaUpload("video", e.target.files[0])}
                  />
                  <label htmlFor="template-instruction-video" className="text-xs cursor-pointer text-[#F58220] underline">
                    {instructionVideoUrl ? "Trocar vídeo" : "Enviar vídeo"}
                  </label>
                  {instructionVideoUrl && (
                    <a href={instructionVideoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 ml-2 underline">
                      Ver atual
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox checked={requiresApproval} onCheckedChange={(v) => setRequiresApproval(v === true)} />
            Exige Aprovação do Gestor (se desativado, conclui direto ao entregar)
          </label>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Destinatário da tarefa</p>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as Template["assignmentType"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSIGNMENT_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignmentType === "SPECIFIC" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Principal</Label>
                  <Select value={primaryEmployeeId} onValueChange={setPrimaryEmployeeId}>
                    <SelectTrigger className="w-full">
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
                    <SelectTrigger className="w-full">
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
            )}

            {assignmentType === "SECTOR" && (
              <div className="space-y-2">
                <Label>Setor de destino</Label>
                <Select value={targetSectorId} onValueChange={setTargetSectorId}>
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
              </div>
            )}

            {assignmentType === "TAG" && (
              <div className="space-y-2">
                <Label>Tag de destino</Label>
                <Input value={targetTag} onChange={(e) => setTargetTag(e.target.value)} placeholder="Ex: Cozinha, Caixa, Limpeza" />
                <p className="text-xs text-gray-400">Precisa casar com a tag cadastrada no perfil do colaborador (ver Colaboradores).</p>
              </div>
            )}

            <p className="text-xs text-gray-400">
              {assignmentType === "SPECIFIC"
                ? "Com principal definido, a tarefa é atribuída automaticamente todo dia. Se ele faltar (sem check-in ou inativo), cai no secundário; se os dois faltarem, cai no Checklist da Gerente/Master."
                : "A tarefa aparece simultaneamente pra todo colaborador elegível — o primeiro que clicar \"Vou Fazer\" reserva pra si, e ela some da tela dos outros."}
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
  const [rejecting, setRejecting] = useState<{ checklist: ChecklistInstance; kind: "FRAUD" | "PARTIAL" } | null>(null)

  // Tarefa escalada para a própria Gerente só pode ser avaliada pelo Master (ver app/api/company/checklists/[id]).
  const canReview = (i: ChecklistInstance) => !(user.role === "COMPANY_GERENTE" && i.employee?.role === "COMPANY_GERENTE")

  const reload = () => {
    setIsLoading(true)
    adminFetch<{ checklists: ChecklistInstance[] }>("/api/company/checklists?scope=team&status=SUBMITTED")
      // Fila de aprovação é exclusiva de tarefas que exigem aprovação do
      // Gestor — as que não exigem já nascem APPROVED/REJECTED direto na
      // entrega (ver lib/checklist-review.ts), nunca aparecem aqui.
      .then((res) => setInstances(res.checklists.filter((i) => i.requiresApproval)))
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
            subtitle={i.employee?.name ?? "—"}
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
                    <MobileCardAction icon={X} label="Fraude/Não Executada" tone="danger" onClick={() => setRejecting({ checklist: i, kind: "FRAUD" })} />
                    <MobileCardAction icon={Minimize2} label="Parcialmente Executada" tone="danger" onClick={() => setRejecting({ checklist: i, kind: "PARTIAL" })} />
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
                <td className="px-4 py-3 text-gray-600">{i.employee?.name ?? "—"}</td>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => setRejecting({ checklist: i, kind: "FRAUD" })}
                        title="Fraude / Não Executada"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => setRejecting({ checklist: i, kind: "PARTIAL" })}
                        title="Parcialmente Executada"
                      >
                        <Minimize2 className="h-4 w-4" />
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
          checklist={rejecting.checklist}
          title={rejecting.kind === "FRAUD" ? "Fraude / Não Executada" : "Parcialmente Executada"}
          confirmLabel="Confirmar"
          status="REJECTED"
          rejectionKind={rejecting.kind}
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
  rejectionKind,
  onClose,
  onDone,
}: {
  checklist: ChecklistInstance
  title: string
  confirmLabel: string
  status: "RETURNED" | "REJECTED"
  rejectionKind?: "FRAUD" | "PARTIAL"
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
      await adminFetch(`/api/company/checklists/${checklist.id}`, { method: "PATCH", body: JSON.stringify({ status, note, rejectionKind }) })
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
          {rejectionKind === "FRAUD" && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
              Aplica a penalidade cheia configurada no Programa Interno (não entregue/fraude).
            </p>
          )}
          {rejectionKind === "PARTIAL" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
              Aplica a penalidade reduzida de execução parcial configurada no Programa Interno.
            </p>
          )}
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
