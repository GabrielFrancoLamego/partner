"use client"

import { useEffect, useState } from "react"
import { Copy, Users, Building2, TrendingUp, Wallet, Trophy, MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminCard, MetricRow, LoadingState, EmptyState } from "@/components/admin/admin-ui"

type AffiliateData = {
  isAffiliate: boolean
  code?: string
  partnerLink?: string
  companyLink?: string
  rewardType?: "FIXED" | "PERCENTAGE" | "PERCENTAGE_RECURRING"
  bonusPerPartner?: number
  bonusPercentage?: number | null
  recurringPercentage?: number | null
  walletBalance?: number
  totalPaid?: number
  totalPending?: number
  metrics?: {
    partnerLinkVisits: number
    companyLinkVisits: number
    leadPartners: number
    convertedPartners: number
    referredCompanies: number
    convertedCompanies: number
    totalConverted: number
  }
  network?: { id: string; name: string; email: string; joinedAt: string; commissionsCount: number }[]
  referredCompanies?: { id: string; name: string; converted: boolean }[]
  milestones?: { id: string; targetCount: number; bonusAmount: number; achievedAt: string | null; progress: number }[]
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const REWARD_LABEL: Record<string, string> = {
  FIXED: "Comissão fixa por indicação convertida",
  PERCENTAGE: "% sobre a 1ª comissão do indicado",
  PERCENTAGE_RECURRING: "% recorrente sobre toda a rede",
}

export default function PartnerAffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null)

  useEffect(() => {
    fetch("/api/partner/affiliate")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ isAffiliate: false }))
  }, [])

  if (!data) return <LoadingState />

  if (!data.isAffiliate) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa de Afiliados</h1>
          <p className="text-gray-600 mt-1 text-sm">Indique novos parceiros e empresas para a Tribuss</p>
        </div>
        <EmptyState message="Você ainda não é um Afiliado Especial. Fale com o Admin da plataforma para ser promovido." />
      </div>
    )
  }

  const copyLink = (path: string) => {
    const url = `${window.location.origin}${path}`
    navigator.clipboard.writeText(url).then(() => alert("Link copiado: " + url))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa de Afiliados</h1>
        <p className="text-gray-600 mt-1 text-sm">{REWARD_LABEL[data.rewardType ?? "FIXED"]}</p>
      </div>

      <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-5 text-white shadow-lg">
        <p className="text-sm opacity-90">Saldo em carteira</p>
        <p className="text-3xl font-bold">{currency(data.walletBalance ?? 0)}</p>
        <div className="flex gap-4 mt-2 text-xs opacity-90">
          <span>Pago: {currency(data.totalPaid ?? 0)}</span>
          <span>A receber: {currency(data.totalPending ?? 0)}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <AdminCard title="Link Especial — Parceiros">
          <p className="text-xs text-gray-500 mb-2 truncate">{data.partnerLink}</p>
          <Button variant="brand" className="w-full" onClick={() => copyLink(data.partnerLink!)}>
            <Copy className="h-4 w-4 mr-2" /> Copiar link
          </Button>
        </AdminCard>
        <AdminCard title="Link Especial — Empresas">
          <p className="text-xs text-gray-500 mb-2 truncate">{data.companyLink}</p>
          <Button variant="brand" className="w-full" onClick={() => copyLink(data.companyLink!)}>
            <Copy className="h-4 w-4 mr-2" /> Copiar link
          </Button>
        </AdminCard>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: MousePointerClick, label: "Acessos (parceiro)", value: data.metrics?.partnerLinkVisits ?? 0 },
          { icon: MousePointerClick, label: "Acessos (empresa)", value: data.metrics?.companyLinkVisits ?? 0 },
          { icon: Users, label: "Leads (parceiros)", value: data.metrics?.leadPartners ?? 0 },
          { icon: TrendingUp, label: "Convertidos", value: data.metrics?.totalConverted ?? 0 },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <m.icon className="h-5 w-5 mx-auto text-[#F58220] mb-1" />
            <p className="text-lg font-bold text-[#3E2415]">{m.value}</p>
            <p className="text-[10px] text-gray-500">{m.label}</p>
          </div>
        ))}
      </div>

      {data.milestones && data.milestones.length > 0 && (
        <AdminCard title="Metas de Milestone" icon={Trophy}>
          <div className="space-y-4">
            {data.milestones.map((m) => (
              <div key={m.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[#3E2415]">
                    Indique {m.targetCount} e ganhe {currency(m.bonusAmount)}
                  </span>
                  <span className={m.achievedAt ? "text-green-600 font-semibold" : "text-gray-400"}>
                    {m.achievedAt ? "Concluído!" : `${m.progress}%`}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] transition-all"
                    style={{ width: `${m.achievedAt ? 100 : m.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      <AdminCard title="Rede de Parceiros Indicados" icon={Users}>
        {!data.network || data.network.length === 0 ? (
          <EmptyState message="Nenhum parceiro indicado ainda." />
        ) : (
          <div className="space-y-2">
            {data.network.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#3E2415]">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.email}</p>
                </div>
                <span
                  className={
                    p.commissionsCount > 0
                      ? "text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5"
                      : "text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5"
                  }
                >
                  {p.commissionsCount > 0 ? "Convertido" : "Lead"}
                </span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {data.referredCompanies && data.referredCompanies.length > 0 && (
        <AdminCard title="Empresas Indicadas" icon={Building2}>
          <div className="space-y-2">
            {data.referredCompanies.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <p className="text-sm font-medium text-[#3E2415]">{c.name}</p>
                <span
                  className={
                    c.converted
                      ? "text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5"
                      : "text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5"
                  }
                >
                  {c.converted ? "Convertida" : "Lead"}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  )
}
