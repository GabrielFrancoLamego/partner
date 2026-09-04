"use client"

import { useEffect, useState } from "react"
import { Users, TrendingUp, Boxes, Trophy } from "lucide-react"
import { adminFetch } from "@/lib/admin-api-client"
import { PeriodFilter } from "@/components/admin/admin-filters"
import { AdminCard, MetricRow, LoadingState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"

type DashboardData = {
  companyName: string
  partners: {
    activePartners: number
    pendingCommissions: { total: number; count: number }
    pendingWithdrawals: { total: number; count: number }
    topPartners: { partnerId: string; name: string; total: number }[]
  }
  operations: {
    totalEmployees: number
    presentToday: number
    attendanceRate: number
    executedChecklists: number
    onTimeChecklists: number
    lateOrFailedChecklists: number
    pendingChecklists: number
    occurrencesThisMonth: number
  }
  me: {
    xpPoints: number
    todayXp: number
    rank: number
    totalRanked: number
    currentLevel: { name: string; requiredXp: number; badgeColorHex: string } | null
    nextLevel: { name: string; requiredXp: number; badgeColorHex: string } | null
    progressToNextPercent: number
  } | null
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function CompanyDashboardPage() {
  const user = useCompanyUser()
  const [period, setPeriod] = useState("month")
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<DashboardData>(`/api/company/dashboard?period=${period}`)
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [period])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Dashboard da Empresa</h1>
          <p className="text-gray-600 mt-1 text-sm">{user.companyName} — visão gerencial unificada</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          {data.me && (
            <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-bold text-[#3E2415]">Meu Progresso</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Nível atual</p>
                  <p className="text-sm font-bold text-[#3E2415]">{data.me.currentLevel?.name ?? "Sem nível"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">XP total</p>
                  <p className="text-sm font-bold text-[#3E2415]">{data.me.xpPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">XP hoje</p>
                  <p className={`text-sm font-bold ${data.me.todayXp >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {data.me.todayXp >= 0 ? "+" : ""}
                    {data.me.todayXp}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ranking interno</p>
                  <p className="text-sm font-bold text-[#3E2415]">
                    #{data.me.rank} de {data.me.totalRanked}
                  </p>
                </div>
              </div>
              {data.me.nextLevel && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progresso para {data.me.nextLevel.name}</span>
                    <span>{data.me.progressToNextPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full transition-all"
                      style={{ width: `${data.me.progressToNextPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminCard title="Parceiros" icon={Users}>
              <MetricRow label="Parceiros ativos no programa" value={data.partners.activePartners} />
              <MetricRow
                label="Comissões pendentes"
                value={`${currency(data.partners.pendingCommissions.total)} (${data.partners.pendingCommissions.count})`}
              />
              <MetricRow
                label="Saques solicitados"
                value={`${currency(data.partners.pendingWithdrawals.total)} (${data.partners.pendingWithdrawals.count})`}
              />
            </AdminCard>

            <AdminCard title="Operação & RH" icon={Boxes}>
              <MetricRow label="Colaboradores" value={data.operations.totalEmployees} />
              <MetricRow
                label="Presença hoje"
                value={`${data.operations.presentToday}/${data.operations.totalEmployees} (${data.operations.attendanceRate}%)`}
              />
              <MetricRow label="Checklists no prazo (mês)" value={data.operations.onTimeChecklists} />
              <MetricRow label="Atrasados/reprovados (mês)" value={data.operations.lateOrFailedChecklists} />
              <MetricRow label="Pendentes de execução" value={data.operations.pendingChecklists} />
              <MetricRow label="Ocorrências no mês" value={data.operations.occurrencesThisMonth} />
            </AdminCard>
          </div>

          <AdminCard title="Top 5 Parceiros da Empresa" icon={TrendingUp}>
            {data.partners.topPartners.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Sem comissões aprovadas no período.</p>
            ) : (
              <div className="space-y-1">
                {data.partners.topPartners.map((p, index) => (
                  <MetricRow key={p.partnerId} label={`${index + 1}. ${p.name}`} value={currency(p.total)} />
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  )
}
