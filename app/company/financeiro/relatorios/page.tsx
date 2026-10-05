"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Banknote, Wallet, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, MetricRow } from "@/components/admin/admin-ui"
import { PeriodFilter } from "@/components/admin/admin-filters"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageFinance, canManageDailyOperations } from "@/lib/permissions"

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function CompanyFinanceReportsPage() {
  const user = useCompanyUser()
  const allowed = canManageFinance(user.role) || canManageDailyOperations(user.role) || user.isFinanceResponsible
  const [period, setPeriod] = useState("month")

  if (!allowed) return <EmptyState message="Acesso restrito ao Master, Gerente e ao Responsável pelo Financeiro." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/company/financeiro">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Financeiro
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Relatórios Financeiros</h1>
          <p className="text-gray-600 mt-1 text-sm">{user.companyName}</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <Tabs defaultValue="withdrawals">
        <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="withdrawals" className="flex-shrink-0">
            <Banknote className="h-3.5 w-3.5 mr-1.5" /> Saques
          </TabsTrigger>
          <TabsTrigger value="wallets" className="flex-shrink-0">
            <Wallet className="h-3.5 w-3.5 mr-1.5" /> Carteiras
          </TabsTrigger>
          <TabsTrigger value="roi" className="flex-shrink-0">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> ROI por Indicações
          </TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="withdrawals">
            <WithdrawalsReport period={period} />
          </TabsContent>
          <TabsContent value="wallets">
            <WalletsReport />
          </TabsContent>
          <TabsContent value="roi">
            <RoiReport period={period} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

type WithdrawalsReportData = {
  paid: { total: number; count: number }
  pending: { total: number; count: number }
  approved: { total: number; count: number }
  rejected: { total: number; count: number }
}

function WithdrawalsReport({ period }: { period: string }) {
  const [data, setData] = useState<WithdrawalsReportData | null>(null)

  useEffect(() => {
    adminFetch<WithdrawalsReportData>(`/api/company/finance/reports?type=withdrawals&period=${period}`).then(setData)
  }, [period])

  if (!data) return <LoadingState />

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <AdminCard title="Saques Realizados (Pagos)" icon={Banknote}>
        <p className="text-2xl font-bold text-green-600">{currency(data.paid.total)}</p>
        <p className="text-xs text-gray-500 mt-1">{data.paid.count} saque(s) pagos no período</p>
      </AdminCard>
      <AdminCard title="Saques Pendentes" icon={Banknote}>
        <p className="text-2xl font-bold text-amber-600">{currency(data.pending.total)}</p>
        <p className="text-xs text-gray-500 mt-1">{data.pending.count} solicitação(ões) aguardando</p>
      </AdminCard>
      <AdminCard title="Aprovados (aguardando pagamento)" icon={Banknote}>
        <p className="text-2xl font-bold text-blue-600">{currency(data.approved.total)}</p>
        <p className="text-xs text-gray-500 mt-1">{data.approved.count} saque(s) aprovados</p>
      </AdminCard>
      <AdminCard title="Recusados/Cancelados" icon={Banknote}>
        <p className="text-2xl font-bold text-red-600">{currency(data.rejected.total)}</p>
        <p className="text-xs text-gray-500 mt-1">{data.rejected.count} saque(s) recusados</p>
      </AdminCard>
    </div>
  )
}

type WalletsReportData = {
  partners: { id: string; name: string; accumulated: number; pendingWithdrawals: number }[]
  employees: { id: string; name: string; pending: number; accumulated: number }[]
}

function WalletsReport() {
  const [data, setData] = useState<WalletsReportData | null>(null)

  useEffect(() => {
    adminFetch<WalletsReportData>("/api/company/finance/reports?type=wallets").then(setData)
  }, [])

  if (!data) return <LoadingState />

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <AdminCard title="Carteiras de Parceiros">
        {data.partners.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhum parceiro com carteira ativa.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.partners.map((p) => (
              <div key={p.id} className="py-2">
                <MetricRow label={p.name} value={`${currency(p.accumulated)} acumulado`} />
                {p.pendingWithdrawals > 0 && <p className="text-xs text-amber-600 text-right">{currency(p.pendingWithdrawals)} em saque pendente</p>}
              </div>
            ))}
          </div>
        )}
      </AdminCard>
      <AdminCard title="Carteiras de Colaboradores">
        {data.employees.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhum colaborador com valores lançados.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.employees
              .filter((e) => e.pending > 0 || e.accumulated > 0)
              .map((e) => (
                <div key={e.id} className="py-2">
                  <MetricRow label={e.name} value={`${currency(e.accumulated)} pago`} />
                  {e.pending > 0 && <p className="text-xs text-amber-600 text-right">{currency(e.pending)} pendente</p>}
                </div>
              ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

type RoiReportData = {
  totalRevenueGenerated: number
  totalCommissionCost: number
  netProfit: number
  roiPercent: number | null
  byPartner: { partnerId: string; name: string; revenueGenerated: number; commissionCost: number }[]
}

function RoiReport({ period }: { period: string }) {
  const [data, setData] = useState<RoiReportData | null>(null)

  useEffect(() => {
    adminFetch<RoiReportData>(`/api/company/finance/reports?type=roi&period=${period}`).then(setData)
  }, [period])

  if (!data) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <AdminCard title="Faturamento Gerado (Scanner PDV)">
          <p className="text-2xl font-bold text-[#3E2415]">{currency(data.totalRevenueGenerated)}</p>
        </AdminCard>
        <AdminCard title="Custo com Comissões">
          <p className="text-2xl font-bold text-red-600">{currency(data.totalCommissionCost)}</p>
        </AdminCard>
        <AdminCard title="Lucro Líquido / ROI">
          <p className={`text-2xl font-bold ${data.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{currency(data.netProfit)}</p>
          {data.roiPercent !== null && <p className="text-xs text-gray-500 mt-1">ROI: {data.roiPercent}%</p>}
        </AdminCard>
      </div>
      <AdminCard title="Por Parceiro">
        {data.byPartner.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhuma comissão aprovada no período.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.byPartner.map((p) => (
              <div key={p.partnerId} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-medium text-[#3E2415]">{p.name}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Faturamento: {currency(p.revenueGenerated)}</span>
                  <span>Comissão: {currency(p.commissionCost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
