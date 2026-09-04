"use client"

import { useEffect, useState } from "react"
import { Building2, TrendingUp, Users, Activity } from "lucide-react"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { CompanyFilter, PeriodFilter } from "@/components/admin/admin-filters"
import { AdminCard, MetricRow, LoadingState } from "@/components/admin/admin-ui"

type DashboardData = {
  business: {
    totalCompanies: number
    growthRate: number
    activeCampaigns: number
    totalBilled: number
    totalCommissionsPaid: number
  }
  referralFunnel: { totalReferrals: number; visited: number; notVisited: number; conversionRate: number }
  operations: { totalEmployees: number; averageXp: number; executedChecklists: number; complianceRate: number }
  usage: { dau: number; mau: number }
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function AdminDashboardPage() {
  const { companies } = useCompanies()
  const [companyId, setCompanyId] = useState("all")
  const [period, setPeriod] = useState("month")
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<DashboardData>(`/api/admin/dashboard?companyId=${companyId}&period=${period}`)
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [companyId, period])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Dashboard Central</h1>
          <p className="text-gray-600 mt-1 text-sm">Visão consolidada de todas as empresas do grupo</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <CompanyFilter companies={companies} value={companyId} onChange={setCompanyId} />
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminCard title="Negócios & Licenças" icon={Building2}>
            <MetricRow label="Total de empresas" value={data.business.totalCompanies} />
            <MetricRow
              label="Taxa de crescimento"
              value={`${data.business.growthRate > 0 ? "+" : ""}${data.business.growthRate}%`}
            />
            <MetricRow label="Campanhas ativas" value={data.business.activeCampaigns} />
            <MetricRow label="Total faturado (comandas)" value={currency(data.business.totalBilled)} />
            <MetricRow label="Comissões pagas" value={currency(data.business.totalCommissionsPaid)} />
          </AdminCard>

          <AdminCard title="Funil de Indicações" icon={TrendingUp}>
            <MetricRow label="Indicações geradas" value={data.referralFunnel.totalReferrals} />
            <MetricRow label="Compareceram (QR escaneado)" value={data.referralFunnel.visited} />
            <MetricRow label="Não compareceram" value={data.referralFunnel.notVisited} />
            <MetricRow label="Taxa de conversão" value={`${data.referralFunnel.conversionRate}%`} />
          </AdminCard>

          <AdminCard title="Operação & RH" icon={Users}>
            <MetricRow label="Total de colaboradores" value={data.operations.totalEmployees} />
            <MetricRow label="Pontuação média de XP" value={data.operations.averageXp} />
            <MetricRow label="Checklists executados" value={data.operations.executedChecklists} />
            <MetricRow label="Taxa de conformidade" value={`${data.operations.complianceRate}%`} />
          </AdminCard>

          <AdminCard title="Métricas de Uso" icon={Activity}>
            <MetricRow label="Usuários Ativos Diários (DAU)" value={data.usage.dau} />
            <MetricRow label="Usuários Ativos Mensais (MAU)" value={data.usage.mau} />
          </AdminCard>
        </div>
      )}
    </div>
  )
}
