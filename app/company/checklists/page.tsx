"use client"

import { useEffect, useState } from "react"
import { Plus, Power, Trash2, Check, X, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  FORTNIGHTLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  TRIMONTHLY: "Trimestral",
}

type Template = {
  id: string
  title: string
  description: string | null
  recurrence: string
  priority: string
  dueTime: string
  active: boolean
  unit: { id: string; name: string } | null
  _count: { instances: number }
}

type ChecklistInstance = {
  id: string
  title: string
  notes: string | null
  photoUrl: string
  priority: string
  status: string
  dueAt: string | null
  createdAt: string
  employee: { id: string; name: string }
  template: { id: string; title: string } | null
}

export default function CompanyChecklistsPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Checklists Operacionais</h1>
        <p className="text-gray-600 mt-1 text-sm">Tarefas por turno com comprovação fotográfica</p>
      </div>

      {isManager ? <ManagerView /> : <EmployeeView />}
    </div>
  )
}

function EmployeeView() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [executing, setExecuting] = useState<Template | "custom" | null>(null)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<Template[]>("/api/company/checklists/templates"),
      adminFetch<ChecklistInstance[]>("/api/company/checklists"),
    ])
      .then(([t, i]) => {
        setTemplates(t)
        setInstances(i)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="font-semibold text-[#3E2415]">Tarefas de hoje</h4>
        {templates.length === 0 ? (
          <EmptyState message="Nenhuma tarefa recorrente configurada." />
        ) : (
          <div className="grid gap-2">
            {templates.map((t) => (
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

      <div className="space-y-3">
        <h4 className="font-semibold text-[#3E2415]">Minhas execuções</h4>
        {instances.length === 0 ? (
          <EmptyState message="Nenhuma execução registrada ainda." />
        ) : (
          <div className="grid gap-2">
            {instances.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                <div>
                  <p className="font-medium text-[#3E2415] text-sm">{i.title}</p>
                  <p className="text-xs text-gray-500">{new Date(i.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <StatusBadge status={i.status} />
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
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
    <Tabs defaultValue="templates">
      <TabsList>
        <TabsTrigger value="templates">Tarefas Recorrentes</TabsTrigger>
        <TabsTrigger value="instances">Execuções</TabsTrigger>
      </TabsList>
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="instances">
          <InstancesTab />
        </TabsContent>
      </div>
    </Tabs>
  )
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Template[]>("/api/company/checklists/templates").then(setTemplates).finally(() => setIsLoading(false))
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
            <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-[#3E2415] text-sm">{t.title}</p>
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {RECURRENCE_LABELS[t.recurrence]} até às {t.dueTime} · {t._count.instances} execuções
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleToggle(t)}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isCreateOpen && (
        <TemplateDialog
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

function TemplateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [recurrence, setRecurrence] = useState("DAILY")
  const [priority, setPriority] = useState("MEDIUM")
  const [dueTime, setDueTime] = useState("18:00")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/checklists/templates", {
        method: "POST",
        body: JSON.stringify({ title, description, recurrence, priority, dueTime }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar tarefa")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Tarefa Recorrente</DialogTitle>
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-2">
            <Label>Horário limite diário</Label>
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InstancesTab() {
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ChecklistInstance[]>("/api/company/checklists?scope=team")
      .then(setInstances)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleReview = async (i: ChecklistInstance, status: "APPROVED" | "REJECTED") => {
    await adminFetch(`/api/company/checklists/${i.id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(
      (e) => alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />
  if (instances.length === 0) return <EmptyState message="Nenhuma execução registrada ainda." />

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
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
              <td className="px-4 py-3 text-[#3E2415] font-medium">{i.title}</td>
              <td className="px-4 py-3 text-gray-600">{i.employee.name}</td>
              <td className="px-4 py-3">
                <a href={i.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] hover:underline">
                  Ver foto
                </a>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={i.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {i.status === "PENDING" && (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleReview(i, "APPROVED")}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleReview(i, "REJECTED")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
