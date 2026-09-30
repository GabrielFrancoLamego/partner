"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Grid3x3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"

type DayCell = { score: number; justification: string | null } | null

type Row = {
  employeeId: string
  employeeName: string
  days: DayCell[]
  total: number
  average: number | null
  evaluatedCount: number
}

type MonthlyMap = { month: string; daysInMonth: number; rows: Row[] }

function scoreColor(score: number) {
  if (score > 1) return "bg-emerald-100 text-emerald-800"
  if (score < -1) return "bg-red-100 text-red-800"
  return "bg-gray-100 text-gray-600"
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Mapa Mensal de Performance — matriz Colaborador x Dia consolidando as notas
 * diárias que a Gerente atribui no Fechamento de Caixa (ver DailyEvaluation),
 * para o Master analisar o histórico do mês de uma vez só.
 */
export default function MonthlyPerformanceMapPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<MonthlyMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<MonthlyMap>(`/api/company/evaluations/monthly-map?month=${month}`)
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [month])

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  }, [month])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415] flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-[#F58220]" /> Mapa Mensal de Performance
          </h1>
          <p className="text-gray-600 mt-1 text-sm">Notas diárias da Gerente por colaborador, consolidadas no mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-[#3E2415] capitalize min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : data.rows.length === 0 ? (
        <EmptyState message="Nenhum colaborador ativo nesta empresa." />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500 min-w-[160px] border-b border-gray-100">
                  Colaborador
                </th>
                {Array.from({ length: data.daysInMonth }, (_, i) => (
                  <th key={i} className="px-1.5 py-2 font-medium text-gray-400 border-b border-gray-100 text-center w-8">
                    {i + 1}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium text-gray-500 border-b border-gray-100 text-center min-w-[70px]">Média</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.employeeId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white px-3 py-2 font-medium text-[#3E2415] whitespace-nowrap">{row.employeeName}</td>
                  {row.days.map((cell, i) => (
                    <td key={i} className="px-0.5 py-1 text-center">
                      {cell ? (
                        <span
                          title={cell.justification ?? undefined}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded ${scoreColor(cell.score)}`}
                        >
                          {cell.score > 0 ? "+" : ""}
                          {cell.score}
                        </span>
                      ) : (
                        <span className="text-gray-200">·</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold text-[#3E2415]">
                    {row.average !== null ? row.average.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
