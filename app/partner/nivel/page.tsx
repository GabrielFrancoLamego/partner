"use client"

import { useEffect, useState } from "react"
import { Lock, Sparkles, Award, History, Rocket } from "lucide-react"
import { LoadingState, AdminCard } from "@/components/admin/admin-ui"
import { MedalGlyph, type MedalIconKey } from "@/components/shared/medal-picker"

type Level = { id: string; name: string; order: number; badgeColorHex: string; medalIcon: MedalIconKey; imageUrl: string | null }
type Dashboard = {
  walletBalance: number
  qualifyingCount: number
  currentLevel:
    | (Level & { commissionPercentage: number; bonusDescription: string | null })
    | null
  nextLevel: (Level & { requiredReferralCount: number; requiredRevenueAmount: number | null; criteria: "REFERRAL_COUNT" | "REVENUE" | "BOTH" }) | null
  levels: Level[]
  commissions: { pending: { total: number; count: number }; approved: { total: number; count: number }; paid: { total: number; count: number } }
  recentCommissions: { id: string; clientName: string; commissionValue: string | null; status: string; date: string; company: { name: string } }[]
}

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_VALUE: "Aguardando valor",
  APPROVED: "Aprovada",
  PAID: "Paga",
  REJECTED: "Rejeitada",
}

function LevelTrail({ levels, currentOrder }: { levels: Level[]; currentOrder: number }) {
  return (
    <div className="flex items-center overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {levels.map((l, idx) => {
        const unlocked = l.order <= currentOrder
        const isCurrent = l.order === currentOrder
        return (
          <div key={l.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1 w-20">
              <div
                className={`relative w-12 h-12 rounded-full flex items-center justify-center border-4 overflow-hidden transition-all ${isCurrent ? "scale-110 shadow-lg" : ""}`}
                style={{ backgroundColor: unlocked ? l.badgeColorHex : "#F3F4F6", borderColor: isCurrent ? "#FFC800" : "transparent" }}
              >
                {!unlocked ? (
                  <Lock className="h-4 w-4 text-gray-400" />
                ) : l.imageUrl ? (
                  <img src={l.imageUrl} alt={l.name} className="w-full h-full object-cover" />
                ) : (
                  <MedalGlyph medalIcon={l.medalIcon === "CUSTOM" ? "GOLD" : l.medalIcon} className="h-5 w-5 text-white" />
                )}
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFC800] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F58220]" />
                  </span>
                )}
              </div>
              <span className={`text-[10px] text-center leading-tight ${unlocked ? "font-semibold text-[#3E2415]" : "text-gray-400"}`}>{l.name}</span>
            </div>
            {idx < levels.length - 1 && (
              <div className={`h-1 w-8 flex-shrink-0 rounded-full ${l.order < currentOrder ? "bg-[#F58220]" : "bg-gray-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PartnerLevelPage() {
  const [data, setData] = useState<Dashboard | null>(null)

  useEffect(() => {
    fetch("/api/partner/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return <LoadingState />

  const currentOrder = data.currentLevel?.order ?? -1
  const missing = data.nextLevel ? Math.max(0, data.nextLevel.requiredReferralCount - data.qualifyingCount) : 0
  const progressPercent = data.nextLevel
    ? Math.max(0, Math.min(100, Math.round((data.qualifyingCount / data.nextLevel.requiredReferralCount) * 100)))
    : 100
  const nextLevelRequirementLabel = data.nextLevel
    ? data.nextLevel.criteria === "REVENUE"
      ? `${currency(data.nextLevel.requiredRevenueAmount ?? 0)} em faturamento gerado`
      : data.nextLevel.criteria === "BOTH" && data.nextLevel.requiredRevenueAmount
        ? `${missing} indicações · ${currency(data.nextLevel.requiredRevenueAmount)} faturados`
        : `${missing} indicações convertidas`
    : ""

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Meu Nível</h1>
        <p className="text-gray-600 mt-1 text-sm">Sua evolução como parceiro Tribuss</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-[#3E2415]">Mapa de Evolução</h3>
        </div>
        <p className="text-2xl font-bold text-[#3E2415]">{data.currentLevel?.name ?? "Sem nível ainda"}</p>
        <p className="text-sm text-gray-500 mb-4">
          {data.qualifyingCount} indicações convertidas
          {data.currentLevel && ` · ${Number(data.currentLevel.commissionPercentage)}% de comissão base`}
        </p>

        {data.levels.length > 0 && <LevelTrail levels={data.levels} currentOrder={currentOrder} />}

        {data.nextLevel && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Rumo a {data.nextLevel.name}</span>
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
      </div>

      {data.nextLevel && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-[#3E2415]">
              Faltam {nextLevelRequirementLabel} para {data.nextLevel.name}
            </p>
          </div>
          <ul className="space-y-1.5">
            {[
              "Indique clientes reais — a comissão só conta após a comanda ser validada no PDV.",
              "Peça para o cliente mencionar seu nome/código na chegada.",
              "Acompanhe suas indicações em Comissões para não perder nenhuma.",
              "Compartilhe as Promoções ativas — elas facilitam a conversão.",
            ].map((tip) => (
              <li key={tip} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-amber-600 flex-shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminCard title="Galeria de Conquistas & Histórico" icon={Award}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Níveis desbloqueados</p>
            <div className="flex flex-wrap gap-3">
              {data.levels
                .filter((l) => l.order <= currentOrder)
                .map((l) => (
                  <div key={l.id} className="flex flex-col items-center gap-1 w-16">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm overflow-hidden"
                      style={{ backgroundColor: l.badgeColorHex }}
                    >
                      {l.imageUrl ? (
                        <img src={l.imageUrl} alt={l.name} className="w-full h-full object-cover" />
                      ) : (
                        <MedalGlyph medalIcon={l.medalIcon === "CUSTOM" ? "GOLD" : l.medalIcon} className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <span className="text-[9px] text-center text-gray-600 leading-tight">{l.name}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <History className="h-3.5 w-3.5" /> Histórico recente
            </p>
            {data.recentCommissions.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma indicação registrada ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {data.recentCommissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1">
                    <div>
                      <span className="text-[#3E2415]">{c.clientName}</span>
                      <span className="text-gray-400"> · {c.company.name}</span>
                    </div>
                    <span className="text-gray-500">{STATUS_LABELS[c.status] ?? c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminCard>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pendente", value: data.commissions.pending.total },
          { label: "Aprovado", value: data.commissions.approved.total },
          { label: "Pago", value: data.commissions.paid.total },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <p className="text-sm font-bold text-[#3E2415]">{currency(m.value)}</p>
            <p className="text-[10px] text-gray-500">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
