"use client"

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState } from "@/components/admin/admin-ui"

type SaasSummary = {
  mrr: number
  paidLicensesCount: number
  overdueCount: number
  overdueValue: number
  churnedThisMonthCount: number
  churnRatePercent: number
  projection: { month: string; projectedMrr: number }[]
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function SaasTab() {
  const [summary, setSummary] = useState<SaasSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    adminFetch<SaasSummary>("/api/admin/finance/saas-summary").then(setSummary).finally(() => setIsLoading(false))
  }, [])

  if (isLoading || !summary) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Receita mensal (MRR)</p>
          <p className="text-lg font-bold text-[#3E2415]">{currency(summary.mrr)}</p>
          <p className="text-xs text-gray-400">{summary.paidLicensesCount} planos pagos no mês</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs text-red-600">Inadimplência</p>
          <p className="text-lg font-bold text-red-700">{summary.overdueCount}</p>
          <p className="text-xs text-red-500">{currency(summary.overdueValue)} em risco</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-700">Churn (30 dias)</p>
          <p className="text-lg font-bold text-amber-800">{summary.churnRatePercent}%</p>
          <p className="text-xs text-amber-600">{summary.churnedThisMonthCount} cancelamentos no mês</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Projeção em 6 meses</p>
          <p className="text-lg font-bold text-[#3E2415]">{currency(summary.projection[5]?.projectedMrr ?? 0)}</p>
          <p className="text-xs text-gray-400">assumindo o churn atual</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Projeção de recebíveis</p>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[480px]">
            <thead className="text-left text-gray-500">
              <tr>
                {summary.projection.map((p) => (
                  <th key={p.month} className="px-2 py-2 font-medium">
                    {new Date(`${p.month}-01`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {summary.projection.map((p) => (
                  <td key={p.month} className="px-2 py-2 font-semibold text-[#3E2415]">
                    {currency(p.projectedMrr)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Projeção simples: MRR atual decaindo pela taxa de churn dos últimos 30 dias — não considera novas vendas.
        </p>
      </div>
    </div>
  )
}
