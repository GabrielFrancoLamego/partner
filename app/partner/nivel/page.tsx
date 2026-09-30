"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Lock, Sparkles, Rocket, Building2 } from "lucide-react"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { MedalGlyph, type MedalIconKey } from "@/components/shared/medal-picker"

type ProgramProgress = {
  programId: string
  programName: string
  companyId: string
  companyName: string
  companyLogoUrl: string | null
  referralCount: number
  revenue: number
  currentLevel: { id: string; name: string; order: number; badgeColorHex: string; medalIcon: MedalIconKey; imageUrl: string | null; commissionPercentage: number } | null
  nextLevel: { id: string; name: string; order: number; requiredReferralCount: number; requiredRevenueAmount: number | null; criteria: "REFERRAL_COUNT" | "REVENUE" | "BOTH" } | null
  progressPercent: number
}

type ProgramLevelsList = { id: string; name: string; order: number; badgeColorHex: string; medalIcon: MedalIconKey; imageUrl: string | null }[]

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function LevelTrail({ levels, currentOrder }: { levels: ProgramLevelsList; currentOrder: number }) {
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

function ProgramLevelCard({ p }: { p: ProgramProgress }) {
  const currentOrder = p.currentLevel?.order ?? -1
  const nextLevelRequirementLabel = p.nextLevel
    ? p.nextLevel.criteria === "REVENUE"
      ? `${currency(Math.max(0, (p.nextLevel.requiredRevenueAmount ?? 0) - p.revenue))} em faturamento`
      : p.nextLevel.criteria === "BOTH"
        ? `${Math.max(0, p.nextLevel.requiredReferralCount - p.referralCount)} indicações e ${currency(Math.max(0, (p.nextLevel.requiredRevenueAmount ?? 0) - p.revenue))} em faturamento`
        : `${Math.max(0, p.nextLevel.requiredReferralCount - p.referralCount)} indicações`
    : ""

  // A régua completa de níveis do programa não vem no endpoint (só atual/próximo) —
  // desenha a trilha com o que se tem: atual + próximo, suficiente pra visualização rápida por empresa.
  const trailLevels: ProgramLevelsList = [
    ...(p.currentLevel ? [{ id: p.currentLevel.id, name: p.currentLevel.name, order: p.currentLevel.order, badgeColorHex: p.currentLevel.badgeColorHex, medalIcon: p.currentLevel.medalIcon as MedalIconKey, imageUrl: p.currentLevel.imageUrl }] : []),
    ...(p.nextLevel ? [{ id: p.nextLevel.id, name: p.nextLevel.name, order: p.nextLevel.order, badgeColorHex: "#C0C0C0", medalIcon: "SILVER" as MedalIconKey, imageUrl: null }] : []),
  ]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        {p.companyLogoUrl ? (
          <img src={p.companyLogoUrl} alt={p.companyName} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-[#3E2415]">{p.companyName}</h3>
          <p className="text-[11px] text-gray-400">{p.programName}</p>
        </div>
      </div>

      <p className="text-2xl font-bold text-[#3E2415]">{p.currentLevel?.name ?? "Sem nível ainda"}</p>
      <p className="text-sm text-gray-500 mb-4">
        {p.referralCount} indicações · {currency(p.revenue)} faturados
        {p.currentLevel && ` · ${p.currentLevel.commissionPercentage}% de comissão base`}
      </p>

      {trailLevels.length > 0 && <LevelTrail levels={trailLevels} currentOrder={currentOrder} />}

      {p.nextLevel && (
        <>
          <div className="mt-4 mb-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Rumo a {p.nextLevel.name}</span>
              <span>{p.progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full transition-all"
                style={{ width: `${p.progressPercent}%` }}
              />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Faltam <strong>{nextLevelRequirementLabel}</strong> para virar {p.nextLevel.name} nesta empresa.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default function PartnerLevelPage() {
  const [progress, setProgress] = useState<ProgramProgress[] | null>(null)

  useEffect(() => {
    fetch("/api/partner/nivel-por-programa")
      .then((r) => r.json())
      .then(setProgress)
      .catch(() => setProgress([]))
  }, [])

  if (!progress) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415] flex items-center gap-2">
          <Rocket className="h-5 w-5 text-[#F58220]" /> Meu Nível por Programa
        </h1>
        <p className="text-gray-600 mt-1 text-sm">Seu nível é calculado separadamente em cada empresa que você participa.</p>
      </div>

      {progress.length === 0 ? (
        <div className="space-y-3">
          <EmptyState message="Você ainda não participa de nenhum programa." />
          <div className="flex justify-center">
            <Link href="/partner/explorar" className="text-sm font-medium text-[#F58220] underline">
              Explorar Programas
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {progress.map((p) => (
            <ProgramLevelCard key={p.programId} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
