"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type Sector = { id: string; name: string; description: string | null; _count: { employees: number } }
type Employee = {
  id: string
  name: string
  sectorId: string | null
  shiftType: "DAY" | "NIGHT" | null
  workStartTime: string | null
  workEndTime: string | null
  breakStartTime: string | null
  breakEndTime: string | null
  bankOfHoursMinutes: number
}

const formatBank = (minutes: number) => {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${String(m).padStart(2, "0")}`
}

export default function CompanySetoresPage() {
  const user = useCompanyUser()
  const allowed = canManageDailyOperations(user.role)

  if (!allowed) return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Setores, Turnos & Banco de Horas</h1>
        <p className="text-gray-600 mt-1 text-sm">Organize a equipe por setor e configure o horário de cada turno</p>
      </div>
      <SectorsPanel />
      <EmployeeScheduleTable />
    </div>
  )
}

function SectorsPanel() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Sector[]>("/api/company/sectors").then(setSectors).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/sectors", { method: "POST", body: JSON.stringify({ name, description }) })
      setName("")
      setDescription("")
      setIsCreateOpen(false)
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar setor")
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
    <AdminCard title="Setores">
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-1" /> Novo Setor
        </Button>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : sectors.length === 0 ? (
        <EmptyState message="Nenhum setor cadastrado ainda (ex: Cozinha, Atendimento, Recepção)." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors.map((s) => (
            <div key={s.id} className="border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[#3E2415] text-sm">{s.name}</p>
                <p className="text-xs text-gray-500">{s._count.employees} colaborador(es)</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} className="text-red-600 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <Dialog open onOpenChange={(open) => !open && setIsCreateOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Setor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
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
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                  Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AdminCard>
  )
}

function EmployeeScheduleTable() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Employee | null>(null)

  const reload = () => {
    setIsLoading(true)
    Promise.all([adminFetch<Employee[]>("/api/company/employees"), adminFetch<Sector[]>("/api/company/sectors")])
      .then(([e, s]) => {
        setEmployees(e)
        setSectors(s)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  if (isLoading) return <LoadingState />

  return (
    <AdminCard title="Turnos & Banco de Horas por Colaborador" icon={Clock}>
      {employees.length === 0 ? (
        <EmptyState message="Nenhum colaborador cadastrado ainda." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Setor</th>
                <th className="px-4 py-3 font-medium">Turno</th>
                <th className="px-4 py-3 font-medium">Horário</th>
                <th className="px-4 py-3 font-medium">Banco de horas</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#3E2415]">{e.name}</td>
                  <td className="px-4 py-3 text-gray-600">{sectors.find((s) => s.id === e.sectorId)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{e.shiftType === "DAY" ? "Diurno" : e.shiftType === "NIGHT" ? "Noturno" : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{e.workStartTime && e.workEndTime ? `${e.workStartTime} – ${e.workEndTime}` : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${e.bankOfHoursMinutes < 0 ? "text-red-600" : e.bankOfHoursMinutes > 0 ? "text-green-600" : "text-gray-400"}`}>
                    {formatBank(e.bankOfHoursMinutes)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [shiftType, setShiftType] = useState(employee.shiftType ?? "DAY")
  const [workStartTime, setWorkStartTime] = useState(employee.workStartTime ?? "08:00")
  const [workEndTime, setWorkEndTime] = useState(employee.workEndTime ?? "18:00")
  const [breakStartTime, setBreakStartTime] = useState(employee.breakStartTime ?? "12:00")
  const [breakEndTime, setBreakEndTime] = useState(employee.breakEndTime ?? "13:00")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sectorId: sectorId === "none" ? null : sectorId,
          shiftType,
          workStartTime,
          workEndTime,
          breakStartTime,
          breakEndTime,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee.name} — Setor & Turno</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger>
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
            <Label>Turno</Label>
            <Select value={shiftType} onValueChange={(v) => setShiftType(v as "DAY" | "NIGHT")}>
              <SelectTrigger>
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
              <Label>Entrada</Label>
              <Input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Saída</Label>
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
          <p className="text-xs text-gray-400">
            O Ponto Digital passa a comparar cada batida de Entrada/Saída contra este horário para calcular o Banco de Horas automaticamente.
          </p>
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
