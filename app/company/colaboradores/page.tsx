"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Pencil, Clock, Users2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type Sector = { id: string; name: string; description: string | null; _count: { employees: number } }

type DaySchedule = { start: string; end: string; breakStart?: string; breakEnd?: string }
type WeeklySchedule = Partial<Record<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN", DaySchedule>>

type Employee = {
  id: string
  name: string
  sectorId: string | null
  tag: string | null
  shiftType: "DAY" | "NIGHT" | null
  workStartTime: string | null
  workEndTime: string | null
  breakStartTime: string | null
  breakEndTime: string | null
  bankOfHoursMinutes: number
  dailyBreakAllowanceMinutes: number
  weeklySchedule: WeeklySchedule | null
  weeklyDayOff: number | null
  hasExtraMonthlyDayOff: boolean
  isFinanceResponsible: boolean
  isSectorCommunicationResponsible: boolean
  status: "ACTIVE" | "INACTIVE"
  employmentType: "FIXO" | "TEMPORARIO" | "DIARISTA"
  contractStartDate: string | null
  contractEndDate: string | null
}

const EMPLOYMENT_TYPE_LABELS: Record<Employee["employmentType"], string> = {
  FIXO: "Fixo",
  TEMPORARIO: "Temporário",
  DIARISTA: "Diarista",
}

const WEEKDAYS: { key: keyof WeeklySchedule; label: string; dayIndex: number }[] = [
  { key: "SUN", label: "Domingo", dayIndex: 0 },
  { key: "MON", label: "Segunda", dayIndex: 1 },
  { key: "TUE", label: "Terça", dayIndex: 2 },
  { key: "WED", label: "Quarta", dayIndex: 3 },
  { key: "THU", label: "Quinta", dayIndex: 4 },
  { key: "FRI", label: "Sexta", dayIndex: 5 },
  { key: "SAT", label: "Sábado", dayIndex: 6 },
]
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const formatBank = (minutes: number) => {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${String(m).padStart(2, "0")}`
}

export default function CompanyColaboradoresPage() {
  const user = useCompanyUser()
  const allowed = canManageDailyOperations(user.role)
  const [sectorsOpen, setSectorsOpen] = useState(false)

  if (!allowed) return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Colaboradores</h1>
          <p className="text-gray-600 mt-1 text-sm">Setores, turnos, horários e banco de horas da equipe.</p>
        </div>
        <Button variant="outline" onClick={() => setSectorsOpen(true)} className="self-start sm:self-auto">
          <Users2 className="h-4 w-4 mr-2" /> Gerenciar Setores
        </Button>
      </div>

      <EmployeeScheduleTable />

      {sectorsOpen && <SectorsDialog onClose={() => setSectorsOpen(false)} />}
    </div>
  )
}

function SectorsDialog({ onClose }: { onClose: () => void }) {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Sector | "new" | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Sector[]>("/api/company/sectors").then(setSectors).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const startEdit = (s: Sector | "new") => {
    setEditing(s)
    setName(s === "new" ? "" : s.name)
    setDescription(s === "new" ? "" : s.description ?? "")
    setError("")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      if (editing === "new") {
        await adminFetch("/api/company/sectors", { method: "POST", body: JSON.stringify({ name, description }) })
      } else if (editing) {
        await adminFetch(`/api/company/sectors/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name, description }) })
      }
      setEditing(null)
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar setor")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (sector: Sector) => {
    if (!confirm(`Excluir o setor "${sector.name}"?`)) return
    await adminFetch(`/api/company/sectors/${sector.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir — verifique se ainda há colaboradores vinculados"),
    )
    reload()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Setores</DialogTitle>
        </DialogHeader>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cozinha" required />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Voltar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                Salvar
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => startEdit("new")} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                <Plus className="h-4 w-4 mr-1" /> Novo Setor
              </Button>
            </div>
            {isLoading ? (
              <LoadingState />
            ) : sectors.length === 0 ? (
              <EmptyState message="Nenhum setor cadastrado ainda (ex: Cozinha, Atendimento, Recepção)." />
            ) : (
              <div className="grid gap-2">
                {sectors.map((s) => (
                  <div key={s.id} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#3E2415] text-sm">{s.name}</p>
                      <p className="text-xs text-gray-500">{s._count.employees} colaborador(es)</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EmployeeScheduleTable() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [statusTab, setStatusTab] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")

  const reload = () => {
    setIsLoading(true)
    Promise.all([adminFetch<Employee[]>(`/api/company/employees?status=${statusTab}`), adminFetch<Sector[]>("/api/company/sectors")])
      .then(([e, s]) => {
        setEmployees(e)
        setSectors(s)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [statusTab])

  const handleReactivate = async (e: Employee) => {
    if (!confirm(`Reativar o acesso de ${e.name}? Use isso ao convocá-lo(a) para um novo turno/contrato.`)) return
    await adminFetch(`/api/company/employees/${e.id}`, { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) }).catch((err) =>
      alert(err instanceof AdminApiError ? err.message : "Erro ao reativar"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />

  return (
    <AdminCard title="Turnos & Banco de Horas por Colaborador" icon={Clock}>
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={statusTab === "ACTIVE" ? "default" : "outline"} onClick={() => setStatusTab("ACTIVE")} className={statusTab === "ACTIVE" ? "bg-[#3E2415] text-white" : ""}>
          Ativos
        </Button>
        <Button size="sm" variant={statusTab === "INACTIVE" ? "default" : "outline"} onClick={() => setStatusTab("INACTIVE")} className={statusTab === "INACTIVE" ? "bg-[#3E2415] text-white" : ""}>
          Bloqueados
        </Button>
      </div>
      {employees.length === 0 ? (
        <EmptyState message={statusTab === "ACTIVE" ? "Nenhum colaborador cadastrado ainda." : "Nenhum colaborador bloqueado."} />
      ) : (
        <>
          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  <th className="px-4 py-3 font-medium">Vínculo</th>
                  <th className="px-4 py-3 font-medium">Setor</th>
                  <th className="px-4 py-3 font-medium">Horário</th>
                  <th className="px-4 py-3 font-medium">Folga fixa</th>
                  <th className="px-4 py-3 font-medium">Banco de horas</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-[#3E2415]">
                      {e.name}
                      <div className="flex gap-1 mt-1">
                        {e.hasExtraMonthlyDayOff && (
                          <span className="text-[10px] font-medium text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">Folga extra/mês</span>
                        )}
                        {e.isFinanceResponsible && (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Financeiro</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{EMPLOYMENT_TYPE_LABELS[e.employmentType]}</td>
                    <td className="px-4 py-3 text-gray-600">{sectors.find((s) => s.id === e.sectorId)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{e.workStartTime && e.workEndTime ? `${e.workStartTime} – ${e.workEndTime}` : "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{e.weeklyDayOff !== null ? WEEKDAY_SHORT[e.weeklyDayOff] : "—"}</td>
                    <td className={`px-4 py-3 font-medium ${e.bankOfHoursMinutes < 0 ? "text-red-600" : e.bankOfHoursMinutes > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {formatBank(e.bankOfHoursMinutes)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/company/colaboradores/${e.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ficha
                      </Button>
                      {statusTab === "INACTIVE" ? (
                        <Button variant="ghost" size="sm" className="text-green-700" onClick={() => handleReactivate(e)}>
                          Reativar/Convocar
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDesktop>

          <MobileCardList>
            {employees.map((e) => (
              <MobileCard
                key={e.id}
                title={e.name}
                subtitle={sectors.find((s) => s.id === e.sectorId)?.name ?? "Sem setor"}
                badges={
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      e.bankOfHoursMinutes < 0 ? "bg-red-50 text-red-600" : e.bankOfHoursMinutes > 0 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {formatBank(e.bankOfHoursMinutes)}
                  </span>
                }
                fields={[
                  { label: "Vínculo", value: EMPLOYMENT_TYPE_LABELS[e.employmentType] },
                  { label: "Horário", value: e.workStartTime && e.workEndTime ? `${e.workStartTime} – ${e.workEndTime}` : "—" },
                  { label: "Folga fixa", value: e.weeklyDayOff !== null ? WEEKDAY_SHORT[e.weeklyDayOff] : "—" },
                ]}
                actions={
                  <>
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/company/colaboradores/${e.id}`)}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ficha
                    </Button>
                    {statusTab === "INACTIVE" ? (
                      <Button variant="ghost" size="sm" className="text-green-700" onClick={() => handleReactivate(e)}>
                        Reativar/Convocar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                        Editar
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </MobileCardList>
        </>
      )}

      {editing && (
        <EmployeeScheduleDialog
          employee={editing}
          sectors={sectors}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </AdminCard>
  )
}

function EmployeeScheduleDialog({
  employee,
  sectors,
  onClose,
  onSaved,
}: {
  employee: Employee
  sectors: Sector[]
  onClose: () => void
  onSaved: () => void
}) {
  const [sectorId, setSectorId] = useState(employee.sectorId ?? "none")
  const [tag, setTag] = useState(employee.tag ?? "")
  const [employmentType, setEmploymentType] = useState<Employee["employmentType"]>(employee.employmentType)
  const [contractStartDate, setContractStartDate] = useState(employee.contractStartDate?.slice(0, 10) ?? "")
  const [contractEndDate, setContractEndDate] = useState(employee.contractEndDate?.slice(0, 10) ?? "")
  const [shiftType, setShiftType] = useState(employee.shiftType ?? "DAY")
  const [workStartTime, setWorkStartTime] = useState(employee.workStartTime ?? "08:00")
  const [workEndTime, setWorkEndTime] = useState(employee.workEndTime ?? "18:00")
  const [breakStartTime, setBreakStartTime] = useState(employee.breakStartTime ?? "12:00")
  const [breakEndTime, setBreakEndTime] = useState(employee.breakEndTime ?? "13:00")
  const [dailyBreakAllowanceMinutes, setDailyBreakAllowanceMinutes] = useState(String(employee.dailyBreakAllowanceMinutes ?? 60))
  const [useWeeklySchedule, setUseWeeklySchedule] = useState(Boolean(employee.weeklySchedule && Object.keys(employee.weeklySchedule).length > 0))
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(employee.weeklySchedule ?? {})
  const [weeklyDayOff, setWeeklyDayOff] = useState(employee.weeklyDayOff !== null ? String(employee.weeklyDayOff) : "none")
  const [hasExtraMonthlyDayOff, setHasExtraMonthlyDayOff] = useState(employee.hasExtraMonthlyDayOff)
  const [isFinanceResponsible, setIsFinanceResponsible] = useState(employee.isFinanceResponsible)
  const [isSectorCommunicationResponsible, setIsSectorCommunicationResponsible] = useState(employee.isSectorCommunicationResponsible)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const setDay = (key: keyof WeeklySchedule, field: keyof DaySchedule, value: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [key]: { start: prev[key]?.start ?? workStartTime, end: prev[key]?.end ?? workEndTime, ...prev[key], [field]: value },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sectorId: sectorId === "none" ? null : sectorId,
          tag: tag.trim() || null,
          employmentType,
          contractStartDate: employmentType === "TEMPORARIO" ? contractStartDate || null : null,
          contractEndDate: employmentType === "TEMPORARIO" ? contractEndDate || null : null,
          shiftType,
          workStartTime,
          workEndTime,
          breakStartTime,
          breakEndTime,
          dailyBreakAllowanceMinutes: Number(dailyBreakAllowanceMinutes) || 0,
          weeklySchedule: useWeeklySchedule ? weeklySchedule : null,
          weeklyDayOff: weeklyDayOff === "none" ? null : Number(weeklyDayOff),
          hasExtraMonthlyDayOff,
          isFinanceResponsible,
          isSectorCommunicationResponsible,
        }),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee.name} — Setor, Turno & Horários</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem setor</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tag (opcional)</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ex: Cozinha, Caixa, Limpeza" />
            <p className="text-xs text-gray-400">Usada em Checklists para endereçar tarefas livres por tag, além de Setor.</p>
          </div>
          <div className="space-y-2">
            <Label>Tipo de Vínculo</Label>
            <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as Employee["employmentType"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXO">Fixo (40% dia 20 + saldo no 5º dia útil)</SelectItem>
                <SelectItem value="TEMPORARIO">Temporário (contrato com data de início/fim)</SelectItem>
                <SelectItem value="DIARISTA">Diarista (pago por diária, acesso bloqueado após o pagamento)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {employmentType === "TEMPORARIO" && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="space-y-2">
                <Label className="text-xs">Início do contrato</Label>
                <Input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Fim do contrato</Label>
                <Input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
              </div>
              <p className="text-[11px] text-amber-700 col-span-2">
                Ao vencer sem pendências financeiras, o acesso é bloqueado automaticamente — reative em "Bloqueados" ao convocar de novo.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Turno</Label>
            <Select value={shiftType} onValueChange={(v) => setShiftType(v as "DAY" | "NIGHT")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">Diurno</SelectItem>
                <SelectItem value="NIGHT">Noturno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Entrada padrão</Label>
              <Input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Saída padrão</Label>
              <Input type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Início do intervalo</Label>
              <Input type="time" value={breakStartTime} onChange={(e) => setBreakStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do intervalo</Label>
              <Input type="time" value={breakEndTime} onChange={(e) => setBreakEndTime(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 pt-2 border-t border-gray-100">
            <Checkbox checked={useWeeklySchedule} onCheckedChange={(v) => setUseWeeklySchedule(v === true)} />
            Horário varia por dia da semana
          </label>
          {useWeeklySchedule && (
            <div className="space-y-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
              {WEEKDAYS.map(({ key, label }) => (
                <div key={key} className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="time"
                    className="h-8 text-xs"
                    value={weeklySchedule[key]?.start ?? ""}
                    onChange={(e) => setDay(key, "start", e.target.value)}
                    placeholder="Entrada"
                  />
                  <Input
                    type="time"
                    className="h-8 text-xs"
                    value={weeklySchedule[key]?.end ?? ""}
                    onChange={(e) => setDay(key, "end", e.target.value)}
                    placeholder="Saída"
                  />
                </div>
              ))}
              <p className="text-[11px] text-gray-400">Deixe um dia em branco para usar o horário padrão acima.</p>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Dia de folga semanal fixo</Label>
            <Select value={weeklyDayOff} onValueChange={setWeeklyDayOff}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum fixo</SelectItem>
                {WEEKDAYS.map(({ dayIndex, label }) => (
                  <SelectItem key={dayIndex} value={String(dayIndex)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tempo total de pausa diária permitida (minutos)</Label>
            <Input type="number" min="0" value={dailyBreakAllowanceMinutes} onChange={(e) => setDailyBreakAllowanceMinutes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <Label className="font-normal">Direito a 1 folga adicional por mês</Label>
              <p className="text-[11px] text-gray-400">Se não for gozada no mês, o sistema sinaliza o pagamento equivalente na folha.</p>
            </div>
            <Switch checked={hasExtraMonthlyDayOff} onCheckedChange={setHasExtraMonthlyDayOff} />
          </div>
          {hasExtraMonthlyDayOff && <MonthlyDayOffStatus employeeId={employee.id} />}

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Papéis especiais</p>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Responsável pelo Financeiro</Label>
              <Switch checked={isFinanceResponsible} onCheckedChange={setIsFinanceResponsible} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Responsável por Comunicações do Setor</Label>
              <Switch checked={isSectorCommunicationResponsible} onCheckedChange={setIsSectorCommunicationResponsible} />
            </div>
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

type DayOffRecord = { used: boolean; usedDate: string | null; paidOut: boolean; paidAmount: string | null }

function MonthlyDayOffStatus({ employeeId }: { employeeId: string }) {
  const month = new Date().toISOString().slice(0, 7)
  const [record, setRecord] = useState<DayOffRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const reload = () => {
    adminFetch<DayOffRecord>(`/api/company/employees/${employeeId}/monthly-day-off?month=${month}`).then(setRecord)
  }
  useEffect(reload, [employeeId])

  const handleAction = async (action: "mark_used" | "mark_paid") => {
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/employees/${employeeId}/monthly-day-off`, { method: "POST", body: JSON.stringify({ month, action }) })
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!record) return null

  return (
    <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100 space-y-2">
      <p className="text-xs font-medium text-purple-800">Folga adicional de {month}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {record.used ? (
        <p className="text-xs text-gray-600">Gozada em {record.usedDate ? new Date(record.usedDate).toLocaleDateString("pt-BR") : "—"}.</p>
      ) : record.paidOut ? (
        <p className="text-xs text-gray-600">
          Não gozada — pagamento de {record.paidAmount ? Number(record.paidAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} lançado na folha (ver Financeiro).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => handleAction("mark_used")}>
            Marcar como gozada
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => handleAction("mark_paid")}>
            Gerar pagamento (não gozada)
          </Button>
        </div>
      )}
    </div>
  )
}
