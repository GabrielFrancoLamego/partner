"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, ExternalLink, ShieldAlert, Trash2, Pencil, Users, CheckCircle2, Settings2, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
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
// Mantido em sincronia com REQUIRES_ATTACHMENT em app/api/company/occurrences/route.ts
const REQUIRES_ATTACHMENT = new Set(["ADVERTENCIA", "ATESTADO", "DISPENSADO", "CONSUMO", "QUEBRA_CAIXA"])
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  TRABALHO: "Trabalho",
  FOLGA_ADICIONAL: "Folga adicional",
  CONSUMO: "Consumo (abate a Conta de Consumo)",
}
const IMPACT_KIND_LABELS: Record<string, string> = {
  POINTS: "Ganho/Perda de Pts",
  SALARY: "Desconto/Bônus no Salário",
  HOURS_BANK: "Banco de Horas",
  INFORMATIONAL: "Informativo (sem impacto)",
}

type Employee = { id: string; name: string; email?: string; canRegisterOccurrences?: boolean; monthlySalary?: string | null }
type CustomOccurrenceType = {
  id: string
  name: string
  kind: "POINTS" | "SALARY" | "HOURS_BANK" | "INFORMATIONAL"
  pointsImpact: number | null
  salaryImpactType: "DISCOUNT" | "BONUS" | null
  salaryImpactValue: string | null
  hoursBankImpactMinutes: number | null
  active: boolean
}
type Occurrence = {
  id: string
  type: string
  customType: { id: string; name: string; kind: string } | null
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

function occurrenceTypeLabel(o: Pick<Occurrence, "type" | "customType">) {
  if (o.type === "CUSTOM") return o.customType?.name ?? "Personalizado"
  return TYPE_LABELS[o.type] ?? o.type
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
  const [customTypes, setCustomTypes] = useState<CustomOccurrenceType[]>([])
  const [successCount, setSuccessCount] = useState(0)

  useEffect(() => {
    adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
    adminFetch<CustomOccurrenceType[]>("/api/company/occurrence-types").then(setCustomTypes)
  }, [])

  return (
    <div className="space-y-4">
      {successCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successCount} ocorrência(s) registrada(s) nesta sessão.
        </div>
      )}
      <OccurrenceForm employees={employees} customTypes={customTypes} onCreated={() => setSuccessCount((c) => c + 1)} />
    </div>
  )
}

function ManagerOccurrences() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(monthNow())
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customTypes, setCustomTypes] = useState<CustomOccurrenceType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Occurrence | null>(null)

  const reload = () => {
    setIsLoading(true)
    const params = new URLSearchParams({ month })
    if (employeeFilter) params.set("employeeId", employeeFilter)
    if (typeFilter) params.set("type", typeFilter)
    adminFetch<Occurrence[]>(`/api/company/occurrences?${params.toString()}`)
      .then(setOccurrences)
      .finally(() => setIsLoading(false))
  }
  const reloadEmployees = () => adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
  const reloadCustomTypes = () => adminFetch<CustomOccurrenceType[]>("/api/company/occurrence-types").then(setCustomTypes)

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, employeeFilter, typeFilter])

  useEffect(() => {
    reloadEmployees()
    reloadCustomTypes()
  }, [])

  // Deep-link do botão flutuante "+Ocorrência" (barra inferior do Gerente/Master)
  // — abre o formulário de criação direto, sem precisar achar o botão na tela.
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setIsCreateOpen(true)
      router.replace("/company/ocorrencias")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
    const label = occurrenceTypeLabel(o)
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})
  const totalCost = occurrences.reduce((sum, o) => (o.discountWaived ? sum : sum + Math.abs(Number(o.total ?? 0))), 0)

  return (
    <Tabs defaultValue="occurrences">
      <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <TabsTrigger value="occurrences" className="flex-shrink-0">Ocorrências</TabsTrigger>
        <TabsTrigger value="types" className="flex-shrink-0">Tipos de Ocorrência</TabsTrigger>
        <TabsTrigger value="access" className="flex-shrink-0">Colaboradores Autorizados</TabsTrigger>
      </TabsList>

      <TabsContent value="occurrences" className="space-y-6 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-white" />
            <Select value={employeeFilter || "ALL"} onValueChange={(v) => setEmployeeFilter(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-44 bg-white">
                <Filter className="h-3.5 w-3.5 mr-1 text-gray-400" />
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os colaboradores</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter || "ALL"} onValueChange={(v) => setTypeFilter(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-44 bg-white">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os tipos</SelectItem>
                {Object.entries(TYPE_LABELS)
                  .filter(([v]) => v !== "CUSTOM")
                  .map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                {customTypes.map((t) => (
                  <SelectItem key={t.id} value={`CUSTOM:${t.id}`}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                {Object.entries(totalByType).map(([label, count]) => (
                  <div key={label} className="text-center p-2 rounded-lg bg-gray-50">
                    <p className="text-lg font-bold text-[#3E2415]">{count}</p>
                    <p className="text-xs text-gray-500">{label}</p>
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
                    { label: "Tipo", value: occurrenceTypeLabel(o) },
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
                      {occurrenceTypeLabel(o)}
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

      <TabsContent value="types" className="mt-4">
        <OccurrenceTypesTab customTypes={customTypes} onChanged={reloadCustomTypes} />
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
              customTypes={customTypes}
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

type OvertimePreview = { hourlyRate: number; hours: number; baseAmount: number; bonus50: number; totalAmount: number }

/** Prévia do valor de Horas Extras — hora calculada pelo horário/salário DESTE colaborador × 1,5. */
function OvertimePreviewHint({ employeeId, hours, onUseValue }: { employeeId: string; hours: string; onUseValue: (perHourValue: number) => void }) {
  const [preview, setPreview] = useState<OvertimePreview | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setPreview(null)
    setError("")
    const hoursNum = Number(hours)
    if (!hoursNum || hoursNum <= 0) return
    const timer = setTimeout(() => {
      adminFetch<OvertimePreview>(`/api/company/occurrences/overtime-preview?employeeId=${employeeId}&hours=${hoursNum}`)
        .then(setPreview)
        .catch((e) => setError(e instanceof AdminApiError ? e.message : "Não foi possível calcular"))
    }, 400)
    return () => clearTimeout(timer)
  }, [employeeId, hours])

  if (error) return <p className="text-xs text-red-500">{error}</p>
  if (!preview) return null

  const perHourWithBonus = Math.round(preview.hourlyRate * 1.5 * 100) / 100
  const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
      <p className="text-blue-900">
        Hora do colaborador: <strong>{currency(preview.hourlyRate)}</strong> · +50%: <strong>{currency(perHourWithBonus)}</strong>/h
      </p>
      <p className="text-blue-900">
        Total para {preview.hours}h: <strong>{currency(preview.totalAmount)}</strong>
      </p>
      <button type="button" onClick={() => onUseValue(perHourWithBonus)} className="text-blue-700 underline font-medium">
        Usar este valor no campo "Valor" (R$/h)
      </button>
    </div>
  )
}

/** Saldo atual da Conta de Consumo do colaborador selecionado — contexto rápido antes de lançar CONSUMO/PAGAMENTO_CONSUMO. */
function ConsumptionDebtHint({ employeeId }: { employeeId: string }) {
  const [debt, setDebt] = useState<number | null>(null)

  useEffect(() => {
    setDebt(null)
    adminFetch<{ debt: number }>(`/api/company/consumption-debt?employeeId=${employeeId}`)
      .then((d) => setDebt(d.debt))
      .catch(() => {})
  }, [employeeId])

  if (debt === null) return null

  return (
    <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-3 text-amber-900">
      Saldo atual da Conta de Consumo: <strong>{currency(debt)}</strong>
    </p>
  )
}

function OccurrenceForm({
  employees,
  customTypes,
  onCreated,
}: {
  employees: Employee[]
  customTypes: CustomOccurrenceType[]
  onCreated: () => void
}) {
  const [mode, setMode] = useState<"registered" | "temp">("registered")
  const [employeeId, setEmployeeId] = useState("")
  const [employeeNameFreeText, setEmployeeNameFreeText] = useState("")
  const [type, setType] = useState("VALE")
  const [customTypeId, setCustomTypeId] = useState("")
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
    if (type === "CUSTOM" && !customTypeId) {
      setError("Selecione o tipo de ocorrência personalizado")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      if (mode === "registered") body.append("employeeId", employeeId)
      else body.append("employeeNameFreeText", employeeNameFreeText.trim())
      body.append("type", type)
      if (type === "CUSTOM") body.append("customTypeId", customTypeId)
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setMode("registered")}
          className={cn("text-xs", mode === "registered" ? "bg-white shadow-sm text-[#3E2415] font-semibold" : "text-gray-500")}
        >
          Colaborador Fixo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setMode("temp")}
          className={cn("text-xs", mode === "temp" ? "bg-white shadow-sm text-[#3E2415] font-semibold" : "text-gray-500")}
        >
          Temporário / Diarista
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
            {Object.entries(TYPE_LABELS)
              .filter(([v]) => v !== "CUSTOM")
              .map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            {customTypes.length > 0 && <SelectItem value="CUSTOM">Personalizado…</SelectItem>}
          </SelectContent>
        </Select>
        {type === "FALTA" && (
          <p className="text-xs text-gray-400">
            Sem valor informado, o sistema abate 1 dia com base no salário-base do colaborador. Um ATESTADO
            registrado em até 24h abona o desconto. Colaborador com Falta hoje fica isento de penalidade de
            checklist no fechamento do dia.
          </p>
        )}
        {type === "BANCO_HORAS" && (
          <p className="text-xs text-gray-400">
            Quantidade = horas de folga concedidas usando o banco de horas do colaborador (será debitado — pode
            ficar negativo). Ele também fica isento de penalidade de checklist no fechamento do dia.
          </p>
        )}
        {type === "CONSUMO" && (
          <p className="text-xs text-gray-400">
            Valor da comanda assinada — soma na Conta de Consumo do colaborador (dívida visível pra ele). Para
            registrar o pagamento dessa dívida, use o tipo "Pagamento de Consumo".
          </p>
        )}
        {type === "QUEBRA_CAIXA" && (
          <p className="text-xs text-gray-400">
            Diferença encontrada no fechamento do caixa — desconta do colaborador, sem relação com a Conta de
            Consumo.
          </p>
        )}
        {type === "PAGAMENTO_CONSUMO" && (
          <p className="text-xs text-gray-400">
            Dinheiro/PIX recebido do colaborador para abater a Conta de Consumo — informe o valor pago no campo
            "Valor".
          </p>
        )}
      </div>

      {type === "HORA_EXTRA" && mode === "registered" && employeeId && (
        <OvertimePreviewHint employeeId={employeeId} hours={quantity} onUseValue={(v) => setValue(String(v))} />
      )}

      {(type === "CONSUMO" || type === "PAGAMENTO_CONSUMO") && mode === "registered" && employeeId && (
        <ConsumptionDebtHint employeeId={employeeId} />
      )}

      {type === "CUSTOM" && (
        <div className="space-y-2">
          <Label>Qual tipo personalizado?</Label>
          <Select value={customTypeId} onValueChange={setCustomTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {customTypes
                .filter((t) => t.active)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {IMPACT_KIND_LABELS[t.kind]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

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

function OccurrenceTypesTab({ customTypes, onChanged }: { customTypes: CustomOccurrenceType[]; onChanged: () => void }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const handleToggleActive = async (t: CustomOccurrenceType) => {
    await adminFetch(`/api/company/occurrence-types/${t.id}`, { method: "PATCH", body: JSON.stringify({ active: !t.active }) }).catch(
      (e) => alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    onChanged()
  }

  const handleDelete = async (t: CustomOccurrenceType) => {
    if (!confirm(`Excluir o tipo "${t.name}"?`)) return
    await adminFetch(`/api/company/occurrence-types/${t.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir — pode haver ocorrências já lançadas com este tipo."),
    )
    onChanged()
  }

  const impactSummary = (t: CustomOccurrenceType) => {
    if (t.kind === "POINTS") return `${(t.pointsImpact ?? 0) >= 0 ? "+" : ""}${t.pointsImpact ?? 0} Pts por ocorrência`
    if (t.kind === "SALARY") return `${t.salaryImpactType === "BONUS" ? "Bônus" : "Desconto"} de R$ ${t.salaryImpactValue ?? 0} por ocorrência`
    if (t.kind === "HOURS_BANK") return `${(t.hoursBankImpactMinutes ?? 0) >= 0 ? "+" : ""}${t.hoursBankImpactMinutes ?? 0} min de banco de horas por ocorrência`
    return "Sem impacto financeiro ou de pontos"
  }

  return (
    <AdminCard title="Tipos de Ocorrência Configuráveis" icon={Settings2}>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-1" /> Novo Tipo
        </Button>
      </div>
      {customTypes.length === 0 ? (
        <EmptyState message="Nenhum tipo personalizado cadastrado. Os tipos fixos (Falta, Advertência, Vale, etc) continuam disponíveis." />
      ) : (
        <div className="space-y-2">
          {customTypes.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
              <div>
                <p className="font-medium text-[#3E2415] text-sm">
                  {t.name} {!t.active && <StatusBadge status="INACTIVE" />}
                </p>
                <p className="text-xs text-gray-500">
                  {IMPACT_KIND_LABELS[t.kind]} · {impactSummary(t)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Switch checked={t.active} onCheckedChange={() => handleToggleActive(t)} />
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isCreateOpen && (
        <OccurrenceTypeDialog
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            onChanged()
          }}
        />
      )}
    </AdminCard>
  )
}

function OccurrenceTypeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<CustomOccurrenceType["kind"]>("POINTS")
  const [pointsImpact, setPointsImpact] = useState("")
  const [salaryImpactType, setSalaryImpactType] = useState<"DISCOUNT" | "BONUS">("DISCOUNT")
  const [salaryImpactValue, setSalaryImpactValue] = useState("")
  const [hoursBankImpactMinutes, setHoursBankImpactMinutes] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/occurrence-types", {
        method: "POST",
        body: JSON.stringify({
          name,
          kind,
          pointsImpact: kind === "POINTS" ? Number(pointsImpact) : undefined,
          salaryImpactType: kind === "SALARY" ? salaryImpactType : undefined,
          salaryImpactValue: kind === "SALARY" ? Number(salaryImpactValue) : undefined,
          hoursBankImpactMinutes: kind === "HOURS_BANK" ? Number(hoursBankImpactMinutes) : undefined,
        }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar tipo")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Tipo de Ocorrência</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome (ex: "Folga Extra Concedida", "Vale-combustível")</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Natureza do impacto</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CustomOccurrenceType["kind"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IMPACT_KIND_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "POINTS" && (
            <div className="space-y-2">
              <Label>Pts por ocorrência (negativo = perda, positivo = ganho)</Label>
              <Input type="number" value={pointsImpact} onChange={(e) => setPointsImpact(e.target.value)} required />
            </div>
          )}

          {kind === "SALARY" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={salaryImpactType} onValueChange={(v) => setSalaryImpactType(v as "DISCOUNT" | "BONUS")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISCOUNT">Desconto</SelectItem>
                    <SelectItem value="BONUS">Bônus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={salaryImpactValue} onChange={(e) => setSalaryImpactValue(e.target.value)} required />
              </div>
            </div>
          )}

          {kind === "HOURS_BANK" && (
            <div className="space-y-2">
              <Label>Minutos por ocorrência (negativo = abate, positivo = credita)</Label>
              <Input
                type="number"
                value={hoursBankImpactMinutes}
                onChange={(e) => setHoursBankImpactMinutes(e.target.value)}
                required
                placeholder="Ex: -480 para abater 8h de folga extra concedida"
              />
            </div>
          )}

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
