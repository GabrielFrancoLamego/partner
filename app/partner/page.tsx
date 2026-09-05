"use client"

import { useEffect, useState } from "react"
import { Wallet, TrendingUp, Award, Clock } from "lucide-react"
import { adminFetch } from "@/lib/admin-api-client"
import { AdminCard, LoadingState, StatusBadge } from "@/components/admin/admin-ui"
import { usePartnerUser } from "@/lib/partner-user-context"

type DashboardData = {
  walletBalance: number
  currentLevel: { id: string; name: string; order: number; badgeColorHex: string; commissionPercentage: number; bonusDescription: string | null } | null
  nextLevel: { id: string; name: string; requiredReferralCount: number; badgeColorHex: string } | null
  levels: { id: string; name: string; order: number; badgeColorHex: string }[]
  qualifyingCount: number
  commissions: {
    pending: { total: number; count: number }
    approved: { total: number; count: number }
    paid: { total: number; count: number }
  }
  recentCommissions: {
    id: string
    clientName: string
    amount: string | null
    commissionValue: string | null
    status: string
    date: string
    company: { name: string }
    promotion: { title: string } | null
  }[]
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function PartnerDashboardPage() {
  const user = usePartnerUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    adminFetch<DashboardData>("/api/partner/dashboard")
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading || !data) return <LoadingState />

  const progressPercent = data.nextLevel
    ? Math.max(0, Math.min(100, Math.round((data.qualifyingCount / data.nextLevel.requiredReferralCount) * 100)))
    : 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Olá, {user.name.split(" ")[0]}!</h1>
        <p className="text-gray-600 mt-1 text-sm">Seu painel de parceiro Tribuss</p>
      </div>

      <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <Wallet className="w-8 h-8 opacity-80" />
          <span className="text-sm font-medium opacity-90">Saldo em Carteira</span>
        </div>
        <p className="text-4xl font-bold">{currency(data.walletBalance)}</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center flex-shrink-0">
            <Award className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-[#3E2415]">Régua de Nível</h3>
        </div>

        {data.currentLevel ? (
          <>
            <p className="text-2xl font-bold text-[#3E2415]">{data.currentLevel.name}</p>
            <p className="text-sm text-gray-500 mb-3">
              {data.currentLevel.commissionPercentage}% de comissão
              {data.currentLevel.bonusDescription && ` · ${data.currentLevel.bonusDescription}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-3">Você ainda não está enquadrado em um nível.</p>
        )}

        {data.nextLevel && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>
                Rumo a {data.nextLevel.name} ({data.qualifyingCount}/{data.nextLevel.requiredReferralCount} indicações)
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {data.levels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.levels.map((l) => (
              <span
                key={l.id}
                className="text-xs font-medium px-3 py-1 rounded-full text-white"
                style={{ backgroundColor: l.badgeColorHex, opacity: data.currentLevel && l.order <= data.currentLevel.order ? 1 : 0.4 }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminCard title="Pendentes" icon={Clock}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(data.commissions.pending.total)}</p>
          <p className="text-xs text-gray-400">{data.commissions.pending.count} comissões</p>
        </AdminCard>
        <AdminCard title="Aprovadas (na carteira)" icon={Wallet}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(data.commissions.approved.total)}</p>
          <p className="text-xs text-gray-400">{data.commissions.approved.count} comissões</p>
        </AdminCard>
        <AdminCard title="Pagas (histórico)" icon={TrendingUp}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(data.commissions.paid.total)}</p>
          <p className="text-xs text-gray-400">{data.commissions.paid.count} comissões</p>
        </AdminCard>
      </div>

      <AdminCard title="Indicações Recentes">
        {data.recentCommissions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhuma indicação registrada ainda.</p>
        ) : (
          <div className="space-y-1">
            {data.recentCommissions.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#3E2415]">{c.clientName}</p>
                  <p className="text-xs text-gray-400">
                    {c.company.name}
                    {c.promotion && ` · ${c.promotion.title}`} · {new Date(c.date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.commissionValue && (
                    <span className="text-sm font-bold text-[#3E2415]">{currency(Number(c.commissionValue))}</span>
                  )}
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
