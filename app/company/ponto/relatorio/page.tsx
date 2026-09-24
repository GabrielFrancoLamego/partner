"use client"

import { useEffect, useState } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type Employee = { id: string; name: string }
type Entry = { id: string; type: string; createdAt: string }
type Report = {
  employeeName: string
  period: { from: string; to: string }
  entries: Entry[]
  faltas: number
  atestados: number
  horasExtrasOcorrencias: number
  bankOfHoursMinutes: number
  workStartTime: string | null
  workEndTime: string | null
}

const TYPE_LABELS: Record<string, string> = { CHECK_IN: "Entrada", BREAK_START: "Pausa", BREAK_END: "Retorno", CHECK_OUT: "Saída" }

const formatBank = (minutes: number) => {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}`
}

/** Tela de impressão do Relatório de Ponto — "Exportar Relatório em PDF" abre isto e usa o diálogo de impressão do navegador (Salvar como PDF). */
export default function PontoRelatorioPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState("")
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<Report | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isManager) adminFetch<Employee[]>("/api/company/employees").then(setEmployees)
    else setEmployeeId(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = () => {
    setIsLoading(true)
    const params = new URLSearchParams({ from, to })
    if (employeeId) params.set("employeeId", employeeId)
    adminFetch<Report>(`/api/company/timeclock/report?${params.toString()}`)
      .then(setReport)
      .finally(() => setIsLoading(false))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      <div className="no-print bg-white rounded-2xl p-4 shadow-md border border-gray-100 space-y-3">
        <h1 className="text-lg font-bold text-[#3E2415]">Relatório de Ponto</h1>
        <div className="grid sm:grid-cols-4 gap-3">
          {isManager && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={!employeeId} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            Gerar Relatório
          </Button>
          {report && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" /> Salvar como PDF
            </Button>
          )}
        </div>
      </div>

      {isLoading && <LoadingState />}

      {report && (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 print:shadow-none print:border-0">
          <h2 className="text-xl font-bold text-[#3E2415]">Relatório de Ponto — {report.employeeName}</h2>
          <p className="text-sm text-gray-500 mb-4">
            Período: {new Date(report.period.from).toLocaleDateString("pt-BR")} a {new Date(report.period.to).toLocaleDateString("pt-BR")}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="text-center p-3 rounded-xl bg-gray-50">
              <p className="text-lg font-bold text-[#3E2415]">{report.faltas}</p>
              <p className="text-xs text-gray-500">Faltas</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gray-50">
              <p className="text-lg font-bold text-[#3E2415]">{report.atestados}</p>
              <p className="text-xs text-gray-500">Atestados</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gray-50">
              <p className="text-lg font-bold text-[#3E2415]">{report.horasExtrasOcorrencias}</p>
              <p className="text-xs text-gray-500">Horas extras (ocorrências)</p>
            </div>
            <div className={`text-center p-3 rounded-xl ${report.bankOfHoursMinutes < 0 ? "bg-red-50" : "bg-green-50"}`}>
              <p className={`text-lg font-bold ${report.bankOfHoursMinutes < 0 ? "text-red-600" : "text-green-600"}`}>
                {formatBank(report.bankOfHoursMinutes)}
              </p>
              <p className="text-xs text-gray-500">Saldo Banco de Horas</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2">Data</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="py-1.5">{TYPE_LABELS[e.type] ?? e.type}</td>
                  <td className="py-1.5">{new Date(e.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
