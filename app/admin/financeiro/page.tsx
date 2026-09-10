"use client"

import { useEffect, useState } from "react"
import { Wallet, Banknote, Clock, XCircle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { CompanyFilter } from "@/components/admin/admin-filters"
import { LoadingState } from "@/components/admin/admin-ui"
import { WithdrawalsTab } from "@/components/admin/financeiro/withdrawals-tab"
import { TransactionsTab } from "@/components/admin/financeiro/transactions-tab"
import { BonusesTab } from "@/components/admin/financeiro/bonuses-tab"
import { SaasTab } from "@/components/admin/financeiro/saas-tab"

type Summary = {
  pendingCommissions: { total: number; count: number }
  withdrawalsPaid: { total: number; count: number }
  withdrawalsPending: { total: number; count: number }
  withdrawalsDenied: { total: number; count: number }
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function AdminFinanceiroPage() {
  const { companies } = useCompanies()
  const [companyId, setCompanyId] = useState("all")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<Summary>(`/api/admin/finance/summary?companyId=${companyId}`)
      .then(setSummary)
      .finally(() => setIsLoading(false))
  }, [companyId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Financeiro Global</h1>
          <p className="text-gray-600 mt-1 text-sm">Comissões, saques PIX e premiações de todo o grupo</p>
        </div>
        <CompanyFilter companies={companies} value={companyId} onChange={setCompanyId} />
      </div>

      {isLoading || !summary ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Comissões pendentes",
              value: currency(summary.pendingCommissions.total),
              count: summary.pendingCommissions.count,
              icon: Wallet,
              color: "from-[#F2680C] via-[#FB9C08] to-[#FFC800]",
            },
            {
              label: "Saques pagos",
              value: currency(summary.withdrawalsPaid.total),
              count: summary.withdrawalsPaid.count,
              icon: Banknote,
              color: "from-green-500 to-emerald-600",
            },
            {
              label: "Saques pendentes",
              value: currency(summary.withdrawalsPending.total),
              count: summary.withdrawalsPending.count,
              icon: Clock,
              color: "from-amber-500 to-orange-600",
            },
            {
              label: "Saques negados",
              value: currency(summary.withdrawalsDenied.total),
              count: summary.withdrawalsDenied.count,
              icon: XCircle,
              color: "from-red-500 to-red-600",
            },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
                <div className={`w-10 h-10 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center shadow-md mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-gray-600 text-xs font-medium mb-1">{card.label}</h3>
                <p className="text-lg font-bold text-[#3E2415]">{card.value}</p>
                <p className="text-xs text-gray-400">{card.count} transações</p>
              </div>
            )
          })}
        </div>
      )}

      <Tabs defaultValue="withdrawals">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="withdrawals">Saques PIX</TabsTrigger>
          <TabsTrigger value="transactions">Extrato</TabsTrigger>
          <TabsTrigger value="bonuses">Bônus & Premiações</TabsTrigger>
          <TabsTrigger value="saas">Receita SaaS</TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
          <TabsContent value="withdrawals">
            <WithdrawalsTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionsTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="bonuses">
            <BonusesTab companyId={companyId} />
          </TabsContent>
          <TabsContent value="saas">
            <SaasTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
