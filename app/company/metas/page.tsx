"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Target, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"
import { GOAL_PERIOD_LABELS } from "@/lib/goal-period"

type GoalScope = "COMPANY" | "SECTOR" | "EMPLOYEE"
type GoalPeriod = "DAILY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"
type Tier = { id: string; order: number; targetAmount: string; bonusAmount: string }
type Progress = {
  id: string
  name: string
  scope: GoalScope
  period: GoalPeriod
  sector: { id: string; name: string } | null
  employee: { id: string; name: string } | null
  tiers: Tier[]
  currentAmount: number
  currentTier: Tier | null
  nextTier: Tier | null
  progressToNextPercent: number
  remainingToNext: number
}
type Sector = { id: string; name: string }
type Employee = { id: string; name: string }

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const SCOPE_LABELS: Record<GoalScope, string> = { COMPANY: "Empresa toda", SECTOR: "Setor", EMPLOYEE: "Colaborador" }

export default function CompanyMetasPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)
  const [goals, setGoals] = useState<Progress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [reportingGoal, setReportingGoal] = useState<Progress | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Progress[]>("/api/company/goals/progress").then(setGoals).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleDelete = async (goal: Progress) => {
    if (!confirm(`Excluir a meta "${goal.name}"?`)) return
    await adminFetch(`/api/company/goals/${goal.id}`, { method: "DELETE" }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"))
    reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Metas Escalonadas</h1>
          <p className="text-gray-600 mt-1 text-sm">Por empresa, setor ou colaborador — com bônus por faixa batida</p>
        </div>
        {isManager && (
          <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            <Plus className="h-4 w-4 mr-1" /> Nova Meta
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : goals.length === 0 ? (
        <EmptyState message="Nenhuma meta ativa ainda." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {goals.map((g) => (
            <AdminCard key={g.id} title={g.name} icon={Target}>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={g.scope} />
                <span className="text-xs text-gray-500">
                  {SCOPE_LABELS[g.scope]}
                  {g.sector && ` · ${g.sector.name}`}
                  {g.employee && ` · ${g.employee.name}`} · {GOAL_PERIOD_LABELS[g.period]}
                </span>
              </div>
              <p className="text-2xl font-bold text-[#3E2415]">{currency(g.currentAmount)}</p>
              {g.nextTier ? (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2 mb-1">
                    <span>
                      Faltam {currency(g.remainingToNext)} para {currency(Number(g.nextTier.targetAmount))} (bônus {currency(Number(g.nextTier.bonusAmount))})
                    </span>
                    <span>{g.progressToNextPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full" style={{ width: `${g.progressToNextPercent}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium text-green-600 mt-2">Todas as faixas batidas neste período! 🎉</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {g.tiers.map((t) => (
                  <span
                    key={t.id}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      g.currentTier && Number(t.order) <= Number(g.currentTier.order) ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {currency(Number(t.targetAmount))} → {currency(Number(t.bonusAmount))}
                  </span>
                ))}
              </div>
              {isManager && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                  {g.scope !== "COMPANY" && (
                    <Button size="sm" variant="outline" onClick={() => setReportingGoal(g)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Lançar resultado do dia
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(g)} className="text-red-600 ml-auto">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </AdminCard>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <CreateGoalDialog
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
      {reportingGoal && (
        <ReportResultDialog
          goal={reportingGoal}
          onClose={() => setReportingGoal(null)}
          onReported={() => {
            setReportingGoal(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function CreateGoalDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [scope, setScope] = useState<GoalScope>("COMPANY")
  const [sectorId, setSectorId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [period, setPeriod] = useState<GoalPeriod>("DAILY")
  const [name, setName] = useState("")
  const [tiers, setTiers] = useState([{ targetAmount: "5000", bonusAmount: "30" }])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<Sector[]>("/api/company/sectors").then(setSectors)
    adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
  }, [])

  const updateTier = (i: number, field: "targetAmount" | "bonusAmount", value: string) => {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (scope === "SECTOR" && !sectorId) {
      setError("Selecione o setor")
      return
    }
    if (scope === "EMPLOYEE" && !employeeId) {
      setError("Selecione o colaborador")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/goals", {
        method: "POST",
        body: JSON.stringify({
          scope,
          sectorId: scope === "SECTOR" ? sectorId : undefined,
          employeeId: scope === "EMPLOYEE" ? employeeId : undefined,
          period,
          name,
          tiers: tiers.map((t) => ({ targetAmount: Number(t.targetAmount), bonusAmount: Number(t.bonusAmount) })),
        }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar meta")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Meta Escalonada</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome da meta</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Meta Diária de Faturamento" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as GoalScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Empresa toda</SelectItem>
                  <SelectItem value="SECTOR">Setor</SelectItem>
                  <SelectItem value="EMPLOYEE">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_PERIOD_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {scope === "SECTOR" && (
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger>
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
          {scope === "EMPLOYEE" && (
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
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
            <Label>Faixas de bônus escalonado</Label>
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Meta (R$)" value={t.targetAmount} onChange={(e) => updateTier(i, "targetAmount", e.target.value)} />
                <Input type="number" placeholder="Bônus (R$)" value={t.bonusAmount} onChange={(e) => updateTier(i, "bonusAmount", e.target.value)} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setTiers((prev) => [...prev, { targetAmount: "", bonusAmount: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar faixa
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Criar Meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReportResultDialog({ goal, onClose, onReported }: { goal: Progress; onClose: () => void; onReported: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("date", date)
      body.append("amount", amount)
      if (file) body.append("file", file)
      await adminFetch(`/api/company/goals/${goal.id}/records`, { method: "POST", body })
      onReported()
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
          <DialogTitle>Lançar resultado — {goal.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Resultado do dia (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Comprovante (opcional)</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
