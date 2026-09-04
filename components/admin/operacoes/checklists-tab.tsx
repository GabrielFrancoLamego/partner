"use client"

import { useEffect, useState } from "react"
import { Plus, Power, Trash2, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"

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
  recurrence: string
  priority: string
  dueTime: string
  active: boolean
  company: { id: string; name: string }
  unit: { id: string; name: string } | null
  _count: { instances: number }
}

type ChecklistInstance = {
  id: string
  title: string
  priority: string
  status: string
  dueAt: string | null
  createdAt: string
  company: { id: string; name: string }
  employee: { id: string; name: string }
  template: { id: string; title: string } | null
}

export function ChecklistsTab() {
  const { companies } = useCompanies()
  const [templates, setTemplates] = useState<Template[]>([])
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [reassigning, setReassigning] = useState<ChecklistInstance | null>(null)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<Template[]>("/api/admin/checklists/templates"),
      adminFetch<ChecklistInstance[]>("/api/admin/checklists"),
    ])
      .then(([t, i]) => {
        setTemplates(t)
        setInstances(i)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleToggleActive = async (template: Template) => {
    await adminFetch(`/api/admin/checklists/templates/${template.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !template.active }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleDelete = async (template: Template) => {
    if (!confirm(`Excluir a tarefa recorrente "${template.title}"?`)) return
    await adminFetch(`/api/admin/checklists/templates/${template.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-[#3E2415]">Tarefas Recorrentes</h4>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Tarefa
          </Button>
        </div>

        {templates.length === 0 ? (
          <EmptyState message="Nenhuma tarefa recorrente criada ainda." />
        ) : (
          <div className="grid gap-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[#3E2415] text-sm">{template.title}</p>
                    <StatusBadge status={template.priority} />
                    <StatusBadge status={template.active ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {template.company.name}
                    {template.unit ? ` · ${template.unit.name}` : ""} · {RECURRENCE_LABELS[template.recurrence]} até
                    às {template.dueTime} · {template._count.instances} execuções
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleToggleActive(template)} title="Ativar/Inativar">
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(template)}
                    title="Excluir"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h4 className="font-semibold text-[#3E2415]">Execuções</h4>
        {instances.length === 0 ? (
          <EmptyState message="Nenhuma execução de checklist registrada ainda." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tarefa</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Responsável</th>
                  <th className="px-4 py-3 font-medium">Prioridade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {instances.map((instance) => (
                  <tr key={instance.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-[#3E2415] font-medium">{instance.title}</td>
                    <td className="px-4 py-3 text-gray-600">{instance.company.name}</td>
                    <td className="px-4 py-3 text-gray-600">{instance.employee.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={instance.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={instance.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setReassigning(instance)} title="Reatribuir">
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isCreateOpen && (
        <TemplateDialog
          companies={companies}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}

      {reassigning && (
        <ReassignDialog
          checklist={reassigning}
          onClose={() => setReassigning(null)}
          onReassigned={() => {
            setReassigning(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function TemplateDialog({
  companies,
  onClose,
  onCreated,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "")
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
      await adminFetch("/api/admin/checklists/templates", {
        method: "POST",
        body: JSON.stringify({ companyId, title, description, recurrence, priority, dueTime }),
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
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Button
              type="submit"
              disabled={isSubmitting || !companyId}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReassignDialog({
  checklist,
  onClose,
  onReassigned,
}: {
  checklist: ChecklistInstance
  onClose: () => void
  onReassigned: () => void
}) {
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [toUserId, setToUserId] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<{ id: string; name: string }[]>(
      `/api/admin/users?role=EMPLOYEE&companyId=${checklist.company.id}`,
    ).then((users) => setEmployees(users.filter((u) => u.id !== checklist.employee.id)))
  }, [checklist])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/admin/checklists/${checklist.id}/reassign`, {
        method: "POST",
        body: JSON.stringify({ toUserId, reason }),
      })
      onReassigned()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao reatribuir")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reatribuir "{checklist.title}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500">
            Responsável atual: <span className="font-medium text-[#3E2415]">{checklist.employee.name}</span>. O
            histórico da transferência fica preservado.
          </p>
          <div className="space-y-2">
            <Label>Novo responsável</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um colaborador" />
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
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !toUserId}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Reatribuir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
