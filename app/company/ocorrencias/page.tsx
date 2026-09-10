"use client"

import { useEffect, useState } from "react"
import { Plus, ExternalLink, ShieldAlert, Trash2, Pencil, Users, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, StatusBadge } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard, MobileCardAction } from "@/components/admin/mobile-card"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

const TYPE_LABELS: Record<string, string> = {
  FOLGA_FERIADO: "Folga/Feriado",
  VALE: "Vale/Adiantamento",
  CONSUMO: "Consumo/Quebra de caixa",
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
}
const REQUIRES_ATTACHMENT = new Set(["ADVERTENCIA", "ATESTADO", "DISPENSADO"])
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  TRABALHO: "Trabalho",
  FOLGA_ADICIONAL: "Folga adicional",
}

type Employee = { id: string; name: string; email?: string; canRegisterOccurrences?: boolean; monthlySalary?: string | null }
type Occurrence = {
  id: string
  type: string
  date: string
  value: string | null
  quantity: string
  total: string | null
  paymentMethod: string | null
  paymentStatus: "PENDING" | "PAID"
  description: string | null
  attachmentUrl: string | null
  discountWaived: boolean
  employee: { id: string; name: string } | null
  employeeNameFreeText: string | null
  createdBy: { id: string; name: string }
}

const currency = (value: string | number | null) =>
  value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const monthNow = () => new Date().toISOString().slice(0, 7)

export default function CompanyOcorrenciasPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)

  if (!isManager && !user.canRegisterOccurrences) {
    return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Ocorrências</h1>
        <p className="text-gray-600 mt-1 text-sm">
          {isManager ? "Advertências, vales, folgas e pagamentos especiais" : "Registro rápido de ocorrências"}
        </p>
      </div>
      {isManager ? <ManagerOccurrences /> : <QuickInsertOnly />}
    </div>
  )
}

/** Visão CREATE_ONLY: apenas o formulário de inclusão, sem histórico, edição ou exclusão. */
function QuickInsertOnly() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [successCount, setSuccessCount] = useState(0)

  useEffect(() => {
    adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
  }, [])

  return (
    <div className="space-y-4">
      {successCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successCount} ocorrência(s) registrada(s) nesta sessão.
        </div>
      )}
      <OccurrenceForm employees={employees} onCreated={() => setSuccessCount((c) => c + 1)} />
    </div>
  )
}

function ManagerOccurrences() {
  const [month, setMonth] = useState(monthNow())
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Occurrence | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Occurrence[]>(`/api/company/occurrences?month=${month}`)
      .then(setOccurrences)
      .finally(() => setIsLoading(false))
  }
  const reloadEmployees = () => adminFetch<Employee[]>("/api/company/employees").then(setEmployees)

  useEffect(() => {
    reload()
    reloadEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const handleDelete = async (o: Occurrence) => {
    if (!confirm("Excluir esta ocorrência?")) return
    await adminFetch(`/api/company/occurrences/${o.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  const handleMarkPaid = async (o: Occurrence) => {
    await adminFetch(`/api/company/occurrences/${o.id}`, {
      method: "PATCH",
      body: JSON.stringify({ paymentStatus: "PAID" }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const totalByType = occurrences.reduce<Record<string, number>>((acc, o) => {
    acc[o.type] = (acc[o.type] ?? 0) + 1
    return acc
  }, {})
  const totalCost = occurrences.reduce((sum, o) => (o.discountWaived ? sum : sum + Math.abs(Number(o.total ?? 0))), 0)

  return (
    <Tabs defaultValue="occurrences">
      <TabsList>
        <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
        <TabsTrigger value="access">Colaboradores Autorizados</TabsTrigger>
      </TabsList>

      <TabsContent value="occurrences" className="space-y-6 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-white" />
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>

        <AdminCard title="Resumo do fechamento" icon={ShieldAlert}>
          {Object.keys(totalByType).length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma ocorrência neste mês.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {Object.entries(totalByType).map(([type, count]) => (
                  <div key={type} className="text-center p-2 rounded-lg bg-gray-50">
                    <p className="text-lg font-bold text-[#3E2415]">{count}</p>
                    <p className="text-xs text-gray-500">{TYPE_LABELS[type] ?? type}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                Custo operacional do mês: <span className="font-bold text-[#3E2415]">{currency(totalCost)}</span>
              </p>
            </>
          )}
        </AdminCard>

        {isLoading ? (
          <LoadingState />
        ) : occurrences.length === 0 ? (
          <EmptyState message="Nenhuma ocorrência registrada neste mês." />
        ) : (
          <>
            <MobileCardList>
              {occurrences.map((o) => (
                <MobileCard
                  key={o.id}
                  title={o.employee?.name ?? o.employeeNameFreeText ?? "—"}
                  subtitle={new Date(o.date).toLocaleDateString("pt-BR")}
                  badges={<StatusBadge status={o.paymentStatus} />}
                  fields={[
                    { label: "Tipo", value: TYPE_LABELS[o.type] ?? o.type },
                    { label: "Total", value: currency(o.total) },
                    { label: "Pagamento", value: o.paymentMethod ? PAYMENT_METHOD_LABELS[o.paymentMethod] : "—" },
                  ]}
                  actions={
                    <>
                      {o.attachmentUrl && (
                        <a href={o.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] underline">
                          Ver anexo
                        </a>
                      )}
                      {o.paymentStatus === "PENDING" && o.total !== null && (
                        <MobileCardAction icon={CheckCircle2} label="Marcar como pago" onClick={() => handleMarkPaid(o)} />
                      )}
                      <MobileCardAction icon={Pencil} label="Editar" onClick={() => setEditing(o)} />
                      <MobileCardAction icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDelete(o)} />
                    </>
                  }
                />
              ))}
            </MobileCardList>

            <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Anexo</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {occurrences.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-[#3E2415]">
                      {o.employee?.name ?? o.employeeNameFreeText}
                      {!o.employee && <span className="ml-1 text-xs text-gray-400">(temp.)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TYPE_LABELS[o.type] ?? o.type}
                      {o.discountWaived && <span className="ml-1 text-xs text-green-600">(abonada)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(o.date).toLocaleDateString("pt-BR")}</td>
                    <td className={`px-4 py-3 font-medium ${Number(o.total ?? 0) < 0 ? "text-red-600" : "text-[#3E2415]"}`}>
                      {currency(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {o.paymentMethod && (
                          <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</span>
                        )}
                        <StatusBadge status={o.paymentStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.attachmentUrl ? (
                        <a href={o.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#F58220] hover:underline">
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {o.paymentStatus === "PENDING" && o.total !== null && (
                          <Button variant="ghost" size="icon" title="Marcar como pago" className="text-green-600" onClick={() => handleMarkPaid(o)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setEditing(o)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(o)} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableDesktop>
          </>
        )}
      </TabsContent>

      <TabsContent value="access" className="mt-4">
        <AuthorizedEmployeesTab employees={employees} onChanged={reloadEmployees} />
      </TabsContent>

      {isCreateOpen && (
        <Dialog open onOpenChange={(open) => !open && setIsCreateOpen(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Ocorrência</DialogTitle>
            </DialogHeader>
            <OccurrenceForm
              employees={employees}
              onCreated={() => {
                setIsCreateOpen(false)
                reload()
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {editing && (
        <EditOccurrenceDialog
          occurrence={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </Tabs>
  )
}

function OccurrenceForm({ employees, onCreated }: { employees: Employee[]; onCreated: () => void }) {
  const [mode, setMode] = useState<"registered" | "temp">("registered")
  const [employeeId, setEmployeeId] = useState("")
  const [employeeNameFreeText, setEmployeeNameFreeText] = useState("")
  const [type, setType] = useState("VALE")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [value, setValue] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [paymentStatus, setPaymentStatus] = useState("PENDING")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requiresAttachment = REQUIRES_ATTACHMENT.has(type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (mode === "registered" && !employeeId) {
      setError("Selecione o colaborador")
      return
    }
    if (mode === "temp" && !employeeNameFreeText.trim()) {
      setError("Informe o nome do colaborador temporário/diarista")
      return
    }
    if (requiresAttachment && !file) {
      setError("Anexo (foto/documento) é obrigatório para este tipo")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      if (mode === "registered") body.append("employeeId", employeeId)
      else body.append("employeeNameFreeText", employeeNameFreeText.trim())
      body.append("type", type)
      body.append("date", date)
      if (value) body.append("value", value)
      body.append("quantity", quantity)
      if (paymentMethod) body.append("paymentMethod", paymentMethod)
      body.append("paymentStatus", paymentStatus)
      if (description) body.append("description", description)
      if (file) body.append("file", file)
      await adminFetch("/api/company/occurrences", { method: "POST", body })
      setEmployeeId("")
      setEmployeeNameFreeText("")
      setValue("")
      setQuantity("1")
      setDescription("")
      setFile(null)
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar ocorrência")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <Button type="button" size="sm" variant={mode === "registered" ? "default" : "ghost"} onClick={() => setMode("registered")} className={mode === "registered" ? "text-xs bg-white shadow-sm" : "text-xs"}>
          Colaborador cadastrado
        </Button>
        <Button type="button" size="sm" variant={mode === "temp" ? "default" : "ghost"} onClick={() => setMode("temp")} className={mode === "temp" ? "text-xs bg-white shadow-sm" : "text-xs"}>
          Temporário/Diarista
        </Button>
      </div>

      {mode === "registered" ? (
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
      ) : (
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={employeeNameFreeText} onChange={(e) => setEmployeeNameFreeText(e.target.value)} placeholder="Nome do temporário/diarista" />
        </div>
      )}

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type === "FALTA" && (
          <p className="text-xs text-gray-400">
            Sem valor informado, o sistema abate 1 dia com base no salário-base do colaborador. Um ATESTADO
            registrado em até 24h abona o desconto.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label>Quantidade</Label>
          <Input type="number" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Forma de pagamento</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status do pagamento</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="PAID">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>{requiresAttachment ? "Anexo (foto/documento) *" : "Anexo (opcional)"}</Label>
        <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white w-full sm:w-auto">
          Registrar
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditOccurrenceDialog({ occurrence, onClose, onSaved }: { occurrence: Occurrence; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(occurrence.value ?? "")
  const [quantity, setQuantity] = useState(occurrence.quantity)
  const [paymentStatus, setPaymentStatus] = useState(occurrence.paymentStatus)
  const [description, setDescription] = useState(occurrence.description ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/occurrences/${occurrence.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value: value === "" ? null : Number(value), quantity: Number(quantity), paymentStatus, description }),
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
          <DialogTitle>Editar Ocorrência</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status do pagamento</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as "PENDING" | "PAID")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="PAID">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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

function AuthorizedEmployeesTab({ employees, onChanged }: { employees: Employee[]; onChanged: () => void }) {
  const handleToggle = async (employee: Employee) => {
    await adminFetch(`/api/company/employees/${employee.id}`, {
      method: "PATCH",
      body: JSON.stringify({ canRegisterOccurrences: !employee.canRegisterOccurrences }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    onChanged()
  }

  const handleSalaryBlur = async (employee: Employee, raw: string) => {
    const next = raw === "" ? null : Number(raw)
    if (next === (employee.monthlySalary ? Number(employee.monthlySalary) : null)) return
    await adminFetch(`/api/company/employees/${employee.id}`, {
      method: "PATCH",
      body: JSON.stringify({ monthlySalary: next }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    onChanged()
  }

  if (employees.length === 0) return <EmptyState message="Nenhum colaborador cadastrado ainda." />

  return (
    <AdminCard title="Permissão de Inclusão Rápida (CREATE_ONLY)" icon={Users}>
      <p className="text-xs text-gray-500 mb-4">
        Colaboradores autorizados podem registrar novas ocorrências, mas não veem o histórico geral nem podem
        editar/excluir lançamentos. O salário-base é usado apenas para calcular o abate automático de FALTA.
      </p>
      <div className="space-y-2">
        {employees.map((e) => (
          <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
            <div>
              <p className="font-medium text-[#3E2415] text-sm">{e.name}</p>
              <p className="text-xs text-gray-400">{e.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Salário-base</span>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={e.monthlySalary ?? ""}
                  onBlur={(ev) => handleSalaryBlur(e, ev.target.value)}
                  className="w-28 h-8 text-sm"
                  placeholder="R$"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Autorizado</span>
                <Switch checked={e.canRegisterOccurrences ?? false} onCheckedChange={() => handleToggle(e)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminCard>
  )
}
