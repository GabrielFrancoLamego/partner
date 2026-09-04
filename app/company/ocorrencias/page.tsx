"use client"

import { useEffect, useState } from "react"
import { Plus, ExternalLink, ShieldAlert } from "lucide-react"
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

const TYPE_LABELS: Record<string, string> = {
  WARNING: "Advertência",
  SALARY_ADVANCE: "Vale/Adiantamento",
  CASH_SHORTAGE: "Quebra de caixa",
  SUSPENSION: "Suspensão",
  DAY_OFF: "Folga",
  HOLIDAY_PAY: "Pagamento de feriado",
  SUNDAY_WORKED_PAY: "Pagamento de domingo trabalhado",
  SUNDAY_DAY_OFF: "Folga de domingo",
}

type Employee = { id: string; name: string }
type Occurrence = {
  id: string
  type: string
  date: string
  amount: string | null
  description: string | null
  documentUrl: string | null
  employee: { id: string; name: string }
  createdBy: { id: string; name: string }
}

const currency = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const monthNow = () => new Date().toISOString().slice(0, 7)

export default function CompanyOcorrenciasPage() {
  const user = useCompanyUser()
  const allowed = canManageDailyOperations(user.role)
  const [month, setMonth] = useState(monthNow())
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Occurrence[]>(`/api/company/occurrences?month=${month}`)
      .then(setOccurrences)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!allowed) return
    reload()
    adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, allowed])

  if (!allowed) {
    return (
      <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />
    )
  }

  const totalByType = occurrences.reduce<Record<string, number>>((acc, o) => {
    acc[o.type] = (acc[o.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Ocorrências do Mês</h1>
          <p className="text-gray-600 mt-1 text-sm">Advertências, vales, folgas e pagamentos especiais</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-white" />
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>
      </div>

      <AdminCard title="Resumo do fechamento" icon={ShieldAlert}>
        {Object.keys(totalByType).length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma ocorrência neste mês.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(totalByType).map(([type, count]) => (
              <div key={type} className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-[#3E2415]">{count}</p>
                <p className="text-xs text-gray-500">{TYPE_LABELS[type] ?? type}</p>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {isLoading ? (
        <LoadingState />
      ) : occurrences.length === 0 ? (
        <EmptyState message="Nenhuma ocorrência registrada neste mês." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {occurrences.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#3E2415]">{o.employee.name}</td>
                  <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[o.type] ?? o.type}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(o.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-gray-600">{o.amount ? currency(o.amount) : "—"}</td>
                  <td className="px-4 py-3">
                    {o.documentUrl ? (
                      <a
                        href={o.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-[#F58220] hover:underline"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{o.createdBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && (
        <CreateOccurrenceDialog
          employees={employees}
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

function CreateOccurrenceDialog({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[]
  onClose: () => void
  onCreated: () => void
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "")
  const [type, setType] = useState("WARNING")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requiresDocument = type === "WARNING"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (requiresDocument && !file) {
      setError("Foto do documento assinado é obrigatória para Advertência")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("employeeId", employeeId)
      body.append("type", type)
      body.append("date", date)
      if (amount) body.append("amount", amount)
      if (description) body.append("description", description)
      if (file) body.append("file", file)
      await adminFetch("/api/company/occurrences", { method: "POST", body })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar ocorrência")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ocorrência</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
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
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Valor (opcional)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{requiresDocument ? "Foto do documento assinado *" : "Documento (opcional)"}</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !employeeId}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
