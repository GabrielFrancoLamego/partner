"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, setFinanceScope } from "@/lib/admin-api-client"
import { FINANCE_CHANGED_EVENT } from "@/lib/finance-events"
import { PayablesTab } from "./payables-tab"
import { CommissionsWithdrawalsTab } from "./commissions-withdrawals-tab"
import { ReceivablesTab } from "./receivables-tab"
import { SettlementsTab } from "./settlements-tab"
import { CountBadge } from "./finance-shared"

const TABS = ["contas-a-pagar", "comissoes-saques", "recebiveis", "quitacoes"] as const
type TabKey = (typeof TABS)[number]

/** `total` (badge do menu) = payables.count + withdrawals.count + receivables.count — a soma exata dos badges das abas. */
type Summary = {
  tabs: { payables: { count: number }; withdrawals: { count: number }; receivables: { count: number } }
  total: number
}

/**
 * Define a empresa-alvo das chamadas ao Financeiro enquanto montado — usado pelo
 * painel do ADMIN (/admin/financeiro) para operar/auditar qualquer empresa com as
 * mesmas telas. O escopo é aplicado na renderização para valer já nos efeitos dos filhos.
 */
export function FinanceScope({ companyId, children }: { companyId: string; children: React.ReactNode }) {
  setFinanceScope(companyId)
  useEffect(() => () => setFinanceScope(null), [])
  return <>{children}</>
}

function useTabState(urlSync: boolean) {
  const router = useRouter()
  const params = useSearchParams()
  const [localTab, setLocalTab] = useState<TabKey>("contas-a-pagar")
  const requested = params.get("tab")
  const urlTab: TabKey = TABS.includes(requested as TabKey) ? (requested as TabKey) : "contas-a-pagar"
  return {
    tab: urlSync ? urlTab : localTab,
    setTab: (value: string) => (urlSync ? router.replace(`/company/financeiro?tab=${value}`, { scroll: false }) : setLocalTab(value as TabKey)),
  }
}

/** Módulo Financeiro (4 sub-abas com contadores) — usado em /company/financeiro (URL ?tab=) e no painel Admin (estado local). */
export function FinanceModule({ urlSync = true, showReportsLink = true, subtitle }: { urlSync?: boolean; showReportsLink?: boolean; subtitle: string }) {
  const { tab, setTab } = useTabState(urlSync)
  const [summary, setSummary] = useState<Summary | null>(null)

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
          <p className="text-gray-600 mt-1 text-sm">{subtitle}</p>
        </div>
        {showReportsLink && (
          <Button asChild variant="outline" size="sm" className="self-start sm:self-auto min-h-11 md:min-h-0">
            <Link href="/company/financeiro/relatorios">
              <BarChart3 className="h-4 w-4 mr-1.5" /> Relatórios
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
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
