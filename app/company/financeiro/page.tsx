"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canOperateFinance } from "@/lib/permissions"
import { FINANCE_CHANGED_EVENT } from "@/lib/finance-events"
import { PayablesTab } from "@/components/company/finance/payables-tab"
import { CommissionsWithdrawalsTab } from "@/components/company/finance/commissions-withdrawals-tab"
import { ReceivablesTab } from "@/components/company/finance/receivables-tab"
import { SettlementsTab } from "@/components/company/finance/settlements-tab"
import { CountBadge } from "@/components/company/finance/finance-shared"

const TABS = ["contas-a-pagar", "comissoes-saques", "recebiveis", "quitacoes"] as const
type TabKey = (typeof TABS)[number]

/** `total` (badge do menu) = payables.count + withdrawals.count + receivables.count — a soma exata dos badges das abas. */
type Summary = {
  tabs: { payables: { count: number }; withdrawals: { count: number }; receivables: { count: number } }
  total: number
}

function FinanceiroContent() {
  const user = useCompanyUser()
  const router = useRouter()
  const params = useSearchParams()
  const [summary, setSummary] = useState<Summary | null>(null)

  const requested = params.get("tab")
  const tab: TabKey = TABS.includes(requested as TabKey) ? (requested as TabKey) : "contas-a-pagar"

  const refreshSummary = useCallback(() => {
    adminFetch<Summary>("/api/company/finance/summary")
      .then(setSummary)
      .catch(() => {})
    window.dispatchEvent(new Event(FINANCE_CHANGED_EVENT))
  }, [])

  useEffect(() => {
    refreshSummary()
  }, [refreshSummary])

  const counters = summary?.tabs

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Financeiro</h1>
          <p className="text-gray-600 mt-1 text-sm">Contas a pagar, saques, comissões, recebíveis e quitações de {user.companyName}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
          <Link href="/company/financeiro/relatorios">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Relatórios
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => router.replace(`/company/financeiro?tab=${value}`, { scroll: false })}>
        <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="contas-a-pagar" className="flex-shrink-0">
            Contas a Pagar
            {counters && <CountBadge count={counters.payables.count} urgent title="Vencidas ou vencendo hoje" />}
          </TabsTrigger>
          <TabsTrigger value="comissoes-saques" className="flex-shrink-0">
            Comissões & Saques
            {counters && <CountBadge count={counters.withdrawals.count} urgent title="Saques aguardando aprovação" />}
          </TabsTrigger>
          <TabsTrigger value="recebiveis" className="flex-shrink-0">
            Recebíveis de Colaboradores
            {counters && <CountBadge count={counters.receivables.count} urgent title="Recebíveis vencendo hoje" />}
          </TabsTrigger>
          <TabsTrigger value="quitacoes" className="flex-shrink-0">
            Registro de Quitação
          </TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="contas-a-pagar">
            <PayablesTab onChanged={refreshSummary} />
          </TabsContent>
          <TabsContent value="comissoes-saques">
            <CommissionsWithdrawalsTab onChanged={refreshSummary} />
          </TabsContent>
          <TabsContent value="recebiveis">
            <ReceivablesTab onChanged={refreshSummary} />
          </TabsContent>
          <TabsContent value="quitacoes">
            <SettlementsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default function CompanyFinanceiroPage() {
  const user = useCompanyUser()
  const allowed = canOperateFinance({ role: user.role, employeeProfile: { isFinanceResponsible: user.isFinanceResponsible } })

  if (!allowed) {
    return <EmptyState message="Acesso restrito ao Master, Gerente e ao Responsável pelo Financeiro." />
  }

  return (
    <Suspense fallback={<LoadingState />}>
      <FinanceiroContent />
    </Suspense>
  )
}
