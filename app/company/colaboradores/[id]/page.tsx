"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Trophy, AlertTriangle, ListChecks, TrendingUp, Pencil, ArrowUpCircle, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations, canConfigureCompany } from "@/lib/permissions"

type BankExtractRow = { date: string; deltaMinutes: number; label: string; source: "TIMECLOCK" | "OCCURRENCE" }
type XpEntryRow = { id: string; points: number; reason: string; note: string | null; createdAt: string }
type OccurrenceRow = { id: string; type: string; date: string; quantity: string; description: string | null; customType: { name: string } | null }
type ChecklistRow = { id: string; title: string; status: string; dueAt: string | null; priority: string }
type EmployeeDetail = {
  id: string
  name: string
  email: string
  phone: string | null
  consumptionDebt: number
  sector: { id: string; name: string } | null
  bankOfHoursMinutes: number
  xpPoints: number
  workStartTime: string | null
  workEndTime: string | null
  weeklyDayOff: number | null
  currentLevel: { id: string; name: string } | null
  bankExtract: BankExtractRow[]
  xpEntries: XpEntryRow[]
  occurrences: OccurrenceRow[]
  todayChecklists: ChecklistRow[]
  efficiency: { avgScore: number | null; checklistTotal: number; checklistApproved: number; checklistRate: number | null }
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const OCCURRENCE_TYPE_LABELS: Record<string, string> = {
  FOLGA_FERIADO: "Folga/Feriado",
  VALE: "Vale/Adiantamento",
  CONSUMO: "Consumo (Conta/Comanda)",
  QUEBRA_CAIXA: "Quebra de Caixa",
  PAGAMENTO_CONSUMO: "Pagamento de Consumo",
  META: "Bonificação de meta",
  FALTA: "Falta",
  ATESTADO: "Atestado",
  ADVERTENCIA: "Advertência",
  SUSPENSAO: "Suspensão",
  DIARIA: "Diária (temporário)",
  HORA_EXTRA: "Hora extra",
  BANCO_HORAS: "Banco de horas",
  DISPENSADO: "Desligamento",
  FIXADO: "Efetivação",
  CUSTOM: "Personalizado",
}

function formatBank(minutes: number) {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${String(m).padStart(2, "0")}`
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = useCompanyUser()
  const [data, setData] = useState<EmployeeDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPromoteOpen, setIsPromoteOpen] = useState(false)
  const [isBonusDescontoOpen, setIsBonusDescontoOpen] = useState(false)
  const isManager = canManageDailyOperations(user.role)
  const isMaster = canConfigureCompany(user.role)

  const reload = () => {
    setIsLoading(true)
    adminFetch<EmployeeDetail>(`/api/company/employees/${params.id}`)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!isManager) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, isManager])

  if (!isManager) {
    return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />
  }
  if (isLoading) return <LoadingState />
  if (notFound || !data) return <EmptyState message="Colaborador não encontrado." />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/company/colaboradores")} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">{data.name}</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {data.currentLevel?.name ?? "Sem cargo"} · {data.sector?.name ?? "Sem setor"}
            {data.workStartTime && data.workEndTime && ` · ${data.workStartTime} – ${data.workEndTime}`}
            {data.weeklyDayOff !== null && ` · Folga: ${WEEKDAY_SHORT[data.weeklyDayOff]}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isMaster && (
            <>
              <Button variant="outline" onClick={() => setIsPromoteOpen(true)}>
                <ArrowUpCircle className="h-4 w-4 mr-1.5" /> Promoção Forçada
              </Button>
              <Button variant="outline" onClick={() => setIsBonusDescontoOpen(true)}>
                <DollarSign className="h-4 w-4 mr-1.5" /> Bônus/Desconto Especial
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push("/company/colaboradores")}>
            <Pencil className="h-4 w-4 mr-1.5" /> Editar Setor/Horário
          </Button>
        </div>
      </div>

      {isMaster && (
        <>
          <ForcedPromotionDialog
            open={isPromoteOpen}
            onOpenChange={setIsPromoteOpen}
            employeeId={data.id}
            employeeName={data.name}
            currentLevelName={data.currentLevel?.name ?? "Sem cargo"}
            onPromoted={reload}
          />
          <BonusDescontoDialog
            open={isBonusDescontoOpen}
            onOpenChange={setIsBonusDescontoOpen}
            employeeId={data.id}
            employeeName={data.name}
            onSaved={reload}
          />
        </>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <p className="text-xs text-gray-500">Banco de Horas</p>
          <p className={`text-2xl font-bold ${data.bankOfHoursMinutes < 0 ? "text-red-600" : data.bankOfHoursMinutes > 0 ? "text-green-600" : "text-[#3E2415]"}`}>
            {formatBank(data.bankOfHoursMinutes)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <p className="text-xs text-gray-500">Pontos (Programa Interno)</p>
          <p className="text-2xl font-bold text-[#3E2415]">{data.xpPoints} Pts</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <p className="text-xs text-gray-500">Conta de Consumo</p>
          <p className={`text-2xl font-bold ${data.consumptionDebt > 0 ? "text-amber-600" : "text-[#3E2415]"}`}>
            {data.consumptionDebt.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>

      <AdminCard title="Eficiência" icon={TrendingUp}>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <p className="text-gray-600">
            Nota diária média (mês): <strong className="text-[#3E2415]">{data.efficiency.avgScore !== null ? data.efficiency.avgScore.toFixed(1) : "— sem avaliações"}</strong>
          </p>
          <p className="text-gray-600">
            Checklist aprovado no mês:{" "}
            <strong className="text-[#3E2415]">
              {data.efficiency.checklistRate !== null ? `${data.efficiency.checklistRate}% (${data.efficiency.checklistApproved}/${data.efficiency.checklistTotal})` : "— sem tarefas"}
            </strong>
          </p>
        </div>
      </AdminCard>

      <AdminCard title="Checklist de Hoje" icon={ListChecks}>
        {data.todayChecklists.length === 0 ? (
          <EmptyState message="Nenhuma tarefa de checklist para hoje." />
        ) : (
          <div className="space-y-2">
            {data.todayChecklists.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <p className="text-sm text-[#3E2415]">{c.title}</p>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Extrato do Banco de Horas" icon={Clock}>
        {data.bankExtract.length === 0 ? (
          <EmptyState message="Nenhuma movimentação registrada ainda." />
        ) : (
          <div className="space-y-2">
            {data.bankExtract.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm text-[#3E2415]">{row.label}</p>
                  <p className="text-xs text-gray-400">{new Date(row.date).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-sm font-semibold ${row.deltaMinutes < 0 ? "text-red-600" : "text-green-600"}`}>{formatBank(row.deltaMinutes)}</span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Pontos — Extrato" icon={Trophy}>
        {data.xpEntries.length === 0 ? (
          <EmptyState message="Nenhuma movimentação de pontos ainda." />
        ) : (
          <div className="space-y-2">
            {data.xpEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm text-[#3E2415]">{e.note ?? e.reason}</p>
                  <p className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-sm font-semibold ${e.points < 0 ? "text-red-600" : "text-green-600"}`}>
                  {e.points > 0 ? "+" : ""}
                  {e.points} Pts
                </span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Ocorrências" icon={AlertTriangle}>
        {data.occurrences.length === 0 ? (
          <EmptyState message="Nenhuma ocorrência registrada ainda." />
        ) : (
          <div className="space-y-2">
            {data.occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm text-[#3E2415]">{o.type === "CUSTOM" ? o.customType?.name ?? "Personalizado" : OCCURRENCE_TYPE_LABELS[o.type] ?? o.type}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(o.date).toLocaleDateString("pt-BR")}
                    {o.description && ` · ${o.description}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

type LevelOption = { id: string; name: string }

/** Alterar o cargo do colaborador manualmente, fora do fluxo normal de promoção por pontuação — exclusivo do Master, exige justificativa (gravada em AuditLog). */
function ForcedPromotionDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  currentLevelName,
  onPromoted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  employeeName: string
  currentLevelName: string
  onPromoted: () => void
}) {
  const [levels, setLevels] = useState<LevelOption[]>([])
  const [levelId, setLevelId] = useState("")
  const [justification, setJustification] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setLevelId("")
    setJustification("")
    setError("")
    adminFetch<LevelOption[]>("/api/company/gamification/levels").then(setLevels)
  }, [open])

  const handleSubmit = async () => {
    if (!levelId) {
      setError("Selecione o novo cargo/nível")
      return
    }
    if (!justification.trim()) {
      setError("Justifique a alteração manual de nível")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      await adminFetch(`/api/company/employees/${employeeId}/promote`, {
        method: "POST",
        body: JSON.stringify({ levelId, justification: justification.trim() }),
      })
      onOpenChange(false)
      onPromoted()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao alterar o cargo")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promoção Forçada — {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Cargo atual: <strong className="text-[#3E2415]">{currentLevelName}</strong>. Alterar o nível manualmente zera a pontuação do colaborador, iniciando um novo ciclo no cargo novo.
          </p>
          <div className="space-y-1.5">
            <Label>Novo cargo/nível</Label>
            <Select value={levelId} onValueChange={setLevelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo cargo" />
              </SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Justificativa (obrigatória)</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Motivo da alteração manual de cargo" rows={3} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} variant="brand">
            Confirmar alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Lançamento avulso do Master — Bônus/Desconto Especial direto na Ficha do Colaborador, compõe a folha do mês (ver /company/folha-pagamento). */
function BonusDescontoDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  employeeName: string
  onSaved: () => void
}) {
  const [kind, setKind] = useState<"BONUS_ESPECIAL" | "DESCONTO_ESPECIAL">("BONUS_ESPECIAL")
  const [value, setValue] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setKind("BONUS_ESPECIAL")
    setValue("")
    setDescription("")
    setError("")
  }, [open])

  const handleSubmit = async () => {
    if (!value || Number(value) <= 0) {
      setError("Informe um valor maior que zero")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      const body = new FormData()
      body.append("employeeId", employeeId)
      body.append("type", kind)
      body.append("value", value)
      if (description.trim()) body.append("description", description.trim())
      await adminFetch("/api/company/occurrences", { method: "POST", body })
      onOpenChange(false)
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao lançar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bônus/Desconto Especial — {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Lançamento avulso que compõe a folha de pagamento do mês (ver Folha de Pagamento).</p>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BONUS_ESPECIAL">Bônus Especial (crédito)</SelectItem>
                <SelectItem value="DESCONTO_ESPECIAL">Desconto Especial (débito)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} variant="brand">
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
