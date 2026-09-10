"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, TrendingUp, Users, Activity, Layers, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { CompanyFilter, PeriodFilter } from "@/components/admin/admin-filters"
import { AdminCard, MetricRow, LoadingState } from "@/components/admin/admin-ui"

type PlanDistributionRow = {
  plan: string
  label: string
  companies: number
  active: number
  overdue: number
  churnCount: number
  churnRate: number
  monthlyRevenue: number
  ltv: number
}

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
  usage: { activeUsers: number; totalUsers: number; engagementRate: number; trend: "up" | "down" | null }
  planDistribution: PlanDistributionRow[]
  companyDetail: {
    pendingWithdrawals: number
    pendingCommissions: number
    pendingShiftClosings: number
    activeEmployees: number
    licenseExpiringSoon: boolean
  } | null
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const PERIOD_LABELS: Record<string, string> = {
  today: "hoje",
  week: "nos últimos 7 dias",
  month: "nos últimos 30 dias",
  year: "no ano",
  all: "no total",
}

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

  const selectedCompany = companies.find((c) => c.id === companyId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Dashboard Central</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {selectedCompany ? `Visão analítica de ${selectedCompany.name}` : "Visão consolidada de todas as empresas do grupo"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <CompanyFilter companies={companies} value={companyId} onChange={setCompanyId} />
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminCard title={selectedCompany ? "Negócios da Empresa" : "Negócios & Licenças"} icon={Building2}>
              {!selectedCompany && (
                <>
                  <MetricRow label="Total de empresas" value={data.business.totalCompanies} />
                  <MetricRow
                    label="Taxa de crescimento"
                    value={`${data.business.growthRate > 0 ? "+" : ""}${data.business.growthRate}%`}
                  />
                </>
              )}
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

            <AdminCard title="Engajamento" icon={Activity}>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {data.usage.activeUsers}
                    <span className="text-sm font-medium text-gray-400"> (de {data.usage.totalUsers} na plataforma)</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">acessaram {PERIOD_LABELS[period] ?? "no período"}</p>
                </div>
                <div
                  className={`flex items-center gap-1 text-lg font-bold ${
                    data.usage.trend === "down" ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {data.usage.trend === "down" ? <ArrowDown className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
                  {data.usage.engagementRate}%
                </div>
              </div>
              <p className="text-[11px] text-gray-400 pt-1">
                % de engajamento = usuários ativos no período / total de usuários da plataforma. Seta compara com o
                período anterior equivalente.
              </p>
            </AdminCard>
          </div>

          {selectedCompany && data.companyDetail && (
            <AdminCard title="Alertas da Empresa" icon={AlertTriangle}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AlertTile label="Saques pendentes" value={data.companyDetail.pendingWithdrawals} />
                <AlertTile label="Comissões pendentes" value={data.companyDetail.pendingCommissions} />
                <AlertTile label="Fechamentos pendentes" value={data.companyDetail.pendingShiftClosings} />
                <AlertTile label="Colaboradores ativos" value={data.companyDetail.activeEmployees} tone="neutral" />
              </div>
              {data.companyDetail.licenseExpiringSoon && (
                <p className="mt-3 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  A licença desta empresa vence em menos de 15 dias.
                </p>
              )}
            </AdminCard>
          )}

          {!selectedCompany && (
            <AdminCard title="Distribuição por Planos SaaS" icon={Layers}>
              <p className="text-xs text-gray-400 -mt-2 mb-2">Clique em um número para ver as empresas naquela condição.</p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[640px]">
                  <thead className="text-left text-gray-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Plano</th>
                      <th className="px-2 py-2 font-medium">Empresas</th>
                      <th className="px-2 py-2 font-medium">Ativas</th>
                      <th className="px-2 py-2 font-medium">Inadimplentes</th>
                      <th className="px-2 py-2 font-medium">Churn</th>
                      <th className="px-2 py-2 font-medium">Arrecadado/mês</th>
                      <th className="px-2 py-2 font-medium">LTV estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.planDistribution.map((row) => (
                      <tr key={row.plan}>
                        <td className="px-2 py-2 font-semibold text-[#3E2415]">{row.label}</td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/cadastros?tab=companies&plan=${row.plan}`}
                            className="underline underline-offset-2 hover:text-orange-600"
                          >
                            {row.companies}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-green-700">
                          <Link
                            href={`/admin/cadastros?tab=companies&plan=${row.plan}&condition=active`}
                            className="underline underline-offset-2 hover:text-orange-600"
                          >
                            {row.active}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-red-600">
                          <Link
                            href={`/admin/cadastros?tab=companies&plan=${row.plan}&condition=overdue`}
                            className="underline underline-offset-2 hover:text-orange-600"
                          >
                            {row.overdue}
                          </Link>
                        </td>
                        <td className="px-2 py-2">
                          {row.churnCount} ({row.churnRate}%)
                        </td>
                        <td className="px-2 py-2">{currency(row.monthlyRevenue)}</td>
                        <td className="px-2 py-2">{currency(row.ltv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                href="/admin/planos"
                className="inline-block mt-3 text-xs font-medium text-orange-700 hover:underline"
              >
                Configurar limites e preços dos planos →
              </Link>
            </AdminCard>
          )}
        </div>
      )}
    </div>
  )
}

function AlertTile({ label, value, tone = "warn" }: { label: string; value: number; tone?: "warn" | "neutral" }) {
  const highlight = tone === "warn" && value > 0
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-amber-700" : "text-[#3E2415]"}`}>{value}</p>
    </div>
  )
}
