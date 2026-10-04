"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Trophy, Gift, Plus, Trash2, Check, X, Package, Settings, Lock, Sparkles, History, Award, Rocket, Gauge, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations, canConfigureCompany } from "@/lib/permissions"
import { MedalGlyph, type MedalIconKey } from "@/components/shared/medal-picker"

type Level = {
  id: string
  name: string
  order: number
  pointsRequired: number
  bonusDescription: string | null
  badgeColorHex: string
  imageUrl: string | null
  medalIcon?: MedalIconKey
  benefitType?: "PERCENTAGE" | "FIXED" | "BOTH"
  salaryIncreasePercent?: string | null
  bonusAmount?: string | null
}
type Reward = { id: string; name: string; description: string | null; costXp: number; stock: number | null; imageUrl: string | null; active: boolean }
type LeaderboardRow = { rank: number; employeeId: string; name: string; xpPoints: number }
type Redemption = {
  id: string
  status: string
  costXp: number
  createdAt: string
  item: { id: string; name: string }
  employee: { id: string; name: string }
}

export default function CompanyCrescimentoPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)
  const isMaster = canConfigureCompany(user.role)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa de Crescimento</h1>
          <p className="text-gray-600 mt-1 text-sm">Trilha de cargos, Pts e loja de prêmios</p>
        </div>
        {isMaster && (
          <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
            <Link href="/company/programa-interno">
              <Settings className="h-4 w-4 mr-1.5" /> Editar Programa
            </Link>
          </Button>
        )}
      </div>
      {isManager ? <ManagerGrowthView /> : <EmployeeGrowthView />}
    </div>
  )
}

type Summary = {
  levels: Level[]
  leaderboard: LeaderboardRow[]
  me: {
    xpPoints: number
    progressToNextPercent: number
    currentLevel: Level | null
    nextLevel: Level | null
    pendingPromotionLevel: { id: string; name: string } | null
  } | null
}

function useSummary() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Summary>("/api/company/gamification/summary").then(setSummary).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])
  return { summary, isLoading, reload }
}

type XpEntry = { id: string; reason: string; points: number; note: string | null; createdAt: string }

function levelBenefitLabel(level: Level | null | undefined): string | null {
  if (!level) return null
  const parts: string[] = []
  if (level.benefitType !== "FIXED" && level.salaryIncreasePercent) parts.push(`+${level.salaryIncreasePercent}% salário`)
  if (level.benefitType !== "PERCENTAGE" && level.bonusAmount) parts.push(`+R$ ${level.bonusAmount} bônus`)
  return parts.length > 0 ? parts.join(" · ") : null
}

const PODIUM_STYLES: Record<1 | 2 | 3, { medal: string; rowClass: string; textClass: string }> = {
  1: { medal: "🥇", rowClass: "bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200", textClass: "text-amber-700" },
  2: { medal: "🥈", rowClass: "bg-gradient-to-r from-gray-50 to-gray-100/60 border border-gray-200", textClass: "text-gray-600" },
  3: { medal: "🥉", rowClass: "bg-gradient-to-r from-orange-50 to-orange-100/60 border border-orange-200", textClass: "text-orange-700" },
}

const XP_REASON_LABELS: Record<string, string> = {
  ATTENDANCE: "Ponto em dia",
  CHECKLIST_ON_TIME: "Checklist no prazo",
  DAILY_EVALUATION: "Avaliação diária",
  OCCURRENCE_PENALTY: "Ocorrência",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  REWARD_REDEMPTION: "Resgate de prêmio",
}

function GrowthTrail({ levels, me }: { levels: Level[]; me: Summary["me"] }) {
  const currentOrder = me?.currentLevel?.order ?? -1
  return (
    <div className="flex items-center overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {levels.map((l, idx) => {
        const unlocked = l.order <= currentOrder
        const isCurrent = l.id === me?.currentLevel?.id
        return (
          <div key={l.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1 w-20">
              <div
                className={`relative w-12 h-12 rounded-full flex items-center justify-center border-4 overflow-hidden transition-all ${
                  isCurrent ? "scale-110 shadow-lg" : ""
                }`}
                style={{
                  backgroundColor: unlocked ? l.badgeColorHex : "#F3F4F6",
                  borderColor: isCurrent ? "#FFC800" : "transparent",
                }}
              >
                {!unlocked ? (
                  <Lock className="h-4 w-4 text-gray-400" />
                ) : l.imageUrl ? (
                  <img src={l.imageUrl} alt={l.name} className="w-full h-full object-cover" />
                ) : (
                  <MedalGlyph medalIcon={l.medalIcon && l.medalIcon !== "CUSTOM" ? l.medalIcon : "GOLD"} className="h-5 w-5 text-white" />
                )}
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFC800] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F58220]" />
                  </span>
                )}
              </div>
              <span className={`text-[10px] text-center leading-tight ${unlocked ? "font-semibold text-[#3E2415]" : "text-gray-400"}`}>
                {l.name}
              </span>
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

function GrowthTips({ me }: { me: Summary["me"] }) {
  if (!me?.nextLevel) return null
  const missing = Math.max(0, me.nextLevel.pointsRequired - me.xpPoints)
  const tips = [
    "Bata o ponto dentro do horário todos os dias — cada check-in em dia soma Pts.",
    "Entregue os checklists antes do prazo, com foto quando exigido.",
    "Mantenha boas notas na Avaliação Diária da Gerência.",
    "Evite ocorrências (faltas, advertências) — elas descontam Pts.",
  ]
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold text-[#3E2415]">
          Faltam {missing} Pts para {me.nextLevel.name}
        </p>
      </div>
      <ul className="space-y-1.5">
        {tips.map((tip) => (
          <li key={tip} className="text-xs text-amber-800 flex items-start gap-1.5">
            <span className="mt-1 h-1 w-1 rounded-full bg-amber-600 flex-shrink-0" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  )
}

type ServiceFeeAdjustment = { percentage: number | null; fixedAmount: number | null; minPoints: number; maxPoints: number } | null
type NextTier = { minPoints: number; maxPoints: number; percentage: number | null; fixedAmount: number | null; pointsMissing: number } | null
type Tier = { id: string; minPoints: number; maxPoints: number; percentage: string | null; fixedAmount: string | null }
type XpHistoryResponse = {
  monthlyScore: number
  basePoints: number
  entries: XpEntry[]
  serviceFeeAdjustment: ServiceFeeAdjustment
  tiers: Tier[]
  nextTier: NextTier
}

function useXpHistory() {
  const [data, setData] = useState<XpHistoryResponse | null>(null)
  useEffect(() => {
    adminFetch<XpHistoryResponse>("/api/company/gamification/xp-history").then(setData)
  }, [])
  return data
}

function feeEffectValue(fee: { percentage: number | null; fixedAmount: number | null }) {
  return (fee.percentage ?? 0) + (fee.fixedAmount ?? 0)
}

function feeEffectLabel(fee: { percentage: number | null; fixedAmount: number | null }) {
  const parts: string[] = []
  if (fee.percentage) parts.push(`${fee.percentage > 0 ? "+" : ""}${fee.percentage}%`)
  if (fee.fixedAmount) parts.push(`${fee.fixedAmount > 0 ? "+" : ""}R$ ${fee.fixedAmount.toFixed(2)}`)
  return parts.join(" · ") || "sem impacto"
}

/**
 * "Projeção de Ganhos e Bônus de Eficiência" — pontuação do mês, faixa atual
 * de Taxa de Serviço/Salário e o próximo degrau (quantos pontos faltam para
 * ampliar o ganho). Usado em /company/crescimento (dashboard do colaborador).
 */
function MonthlyScoreCard() {
  const data = useXpHistory()
  if (!data) return null

  const percent = data.basePoints > 0 ? Math.max(0, Math.min(100, Math.round((data.monthlyScore / data.basePoints) * 100))) : 0
  const { serviceFeeAdjustment: fee, nextTier } = data
  const effect = fee ? feeEffectValue(fee) : 0

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center">
          <Gauge className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-base font-bold text-[#3E2415]">Projeção de Ganhos e Bônus de Eficiência</h3>
      </div>

      <div className="flex items-end gap-1.5 mb-2">
        <span className="text-3xl font-bold text-[#3E2415]">{data.monthlyScore}</span>
        <span className="text-sm text-gray-400 mb-1">/ {data.basePoints} pts este mês</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${data.monthlyScore < 0 ? "bg-red-500" : "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800]"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {fee ? (
        <div className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${effect > 0 ? "bg-green-50 text-green-700" : effect < 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"}`}>
          {effect > 0 ? <TrendingUp className="h-4 w-4 flex-shrink-0" /> : effect < 0 ? <TrendingDown className="h-4 w-4 flex-shrink-0" /> : <Gauge className="h-4 w-4 flex-shrink-0" />}
          <span>
            Faixa atual ({fee.minPoints}-{fee.maxPoints} pts): {feeEffectLabel(fee)} na Taxa de Serviço/Salário deste mês.
          </span>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-1">Nenhuma faixa de Taxa de Serviço configurada para a pontuação atual.</p>
      )}

      {nextTier && (
        <p className="text-xs text-amber-700 mt-2">
          Faltam <strong>{nextTier.pointsMissing}</strong> pts para a próxima faixa ({nextTier.minPoints}-{nextTier.maxPoints} pts):{" "}
          {feeEffectLabel(nextTier)}.
        </p>
      )}
    </div>
  )
}

/** Histórico de Ocorrências do mês — onde o colaborador ganhou/perdeu pontos. */
function OccurrenceHistoryTable() {
  const data = useXpHistory()

  return (
    <AdminCard title="Histórico de Ocorrências do Mês" icon={History}>
      {!data ? (
        <p className="text-xs text-gray-400">Carregando...</p>
      ) : data.entries.length === 0 ? (
        <EmptyState message="Nenhuma ocorrência de pontos neste mês ainda." />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-1 py-2 font-medium">Data</th>
                <th className="px-1 py-2 font-medium">Motivo</th>
                <th className="px-1 py-2 font-medium text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.entries.map((h) => (
                <tr key={h.id}>
                  <td className="px-1 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-1 py-2 text-xs text-[#3E2415]">
                    {XP_REASON_LABELS[h.reason] ?? h.reason}
                    {h.note && <span className="text-gray-400"> · {h.note}</span>}
                  </td>
                  <td className={`px-1 py-2 text-right text-xs font-semibold whitespace-nowrap ${h.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {h.points >= 0 ? "+" : ""}
                    {h.points} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  )
}

function AchievementsGallery({ levels, me }: { levels: Level[]; me: Summary["me"] }) {
  const currentOrder = me?.currentLevel?.order ?? -1
  const unlockedLevels = levels.filter((l) => l.order <= currentOrder)

  return (
    <AdminCard title="Galeria de Conquistas" icon={Award}>
      {unlockedLevels.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma medalha ainda — comece a acumular Pts!</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {unlockedLevels.map((l) => (
            <div key={l.id} className="flex flex-col items-center gap-1 w-16">
              {l.imageUrl ? (
                <img src={l.imageUrl} alt={l.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: l.badgeColorHex }}>
                  <MedalGlyph medalIcon={l.medalIcon && l.medalIcon !== "CUSTOM" ? l.medalIcon : "GOLD"} className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="text-[9px] text-center text-gray-600 leading-tight">{l.name}</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

function EmployeeGrowthView() {
  const { summary, isLoading, reload } = useSummary()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [showRegulamento, setShowRegulamento] = useState(false)

  const reloadRewards = () => {
    adminFetch<Reward[]>("/api/company/gamification/rewards").then(setRewards)
    adminFetch<Redemption[]>("/api/company/gamification/redemptions").then(setRedemptions)
  }
  useEffect(reloadRewards, [])

  const handleRedeem = async (reward: Reward) => {
    if (!confirm(`Resgatar "${reward.name}" por ${reward.costXp} Pts?`)) return
    await adminFetch(`/api/company/gamification/rewards/${reward.id}/redeem`, { method: "POST" })
      .then(() => {
        reload()
        reloadRewards()
      })
      .catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao resgatar"))
  }

  const handleAcceptPromotion = async () => {
    if (!confirm(`Aceitar a promoção para ${me?.pendingPromotionLevel?.name}?`)) return
    await adminFetch("/api/company/gamification/promotion/accept", { method: "POST" })
      .then(() => reload())
      .catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao aceitar promoção"))
  }

  if (isLoading || !summary) return <LoadingState />
  const me = summary.me

  return (
    <div className="space-y-6">
      {me?.pendingPromotionLevel && (
        <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-5 shadow-md text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold">🎉 Você tem uma promoção disponível!</p>
            <p className="text-sm opacity-90">Novo cargo: {me.pendingPromotionLevel.name}</p>
          </div>
          <Button onClick={handleAcceptPromotion} className="bg-white text-[#F2680C] hover:bg-white/90 flex-shrink-0">
            Aceitar Promoção
          </Button>
        </div>
      )}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-[#3E2415]">Mapa de Evolução</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowRegulamento(true)}>
            Ver Regulamento do Programa
          </Button>
        </div>
        <p className="text-2xl font-bold text-[#3E2415]">{me?.currentLevel?.name ?? "Sem nível ainda"}</p>
        <p className="text-sm text-gray-500 mb-4">{me?.xpPoints ?? 0} Pts acumulados</p>

        <GrowthTrail levels={summary.levels} me={me} />

        {me?.nextLevel && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Rumo a {me.nextLevel.name}</span>
              <span>{me.progressToNextPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full transition-all"
                style={{ width: `${me.progressToNextPercent}%` }}
              />
            </div>
            {levelBenefitLabel(me.nextLevel) && (
              <p className="text-xs text-[#F58220] font-medium mt-1.5">🎁 Benefício: {levelBenefitLabel(me.nextLevel)}</p>
            )}
          </div>
        )}
      </div>

      <MonthlyScoreCard />

      <GrowthTips me={me} />

      <AchievementsGallery levels={summary.levels} me={me} />

      <OccurrenceHistoryTable />

      {rewards.length > 0 && (
        <AdminCard title="Loja de Prêmios" icon={Gift}>
          <div className="grid sm:grid-cols-2 gap-3">
            {rewards.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#3E2415] text-sm truncate">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.costXp} Pts {r.stock !== null && `· ${r.stock} disponíveis`}</p>
                </div>
                <Button
                  size="sm"
                  disabled={(me?.xpPoints ?? 0) < r.costXp || (r.stock !== null && r.stock <= 0)}
                  onClick={() => handleRedeem(r)}
                  className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white flex-shrink-0"
                >
                  Resgatar
                </Button>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {redemptions.length > 0 && (
        <AdminCard title="Meus Resgates">
          <div className="space-y-2">
            {redemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-[#3E2415]">{r.item.name}</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {showRegulamento && <RegulamentoDialog onClose={() => setShowRegulamento(false)} />}
    </div>
  )
}

type InternalProgramRegulamento = { title: string; termsContent: string | null; pdfUrl: string | null }

function RegulamentoDialog({ onClose }: { onClose: () => void }) {
  const [program, setProgram] = useState<InternalProgramRegulamento | null>(null)

  useEffect(() => {
    adminFetch<InternalProgramRegulamento>("/api/company/internal-program").then(setProgram)
  }, [])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Regulamento do Programa{program ? `: ${program.title}` : ""}</DialogTitle>
        </DialogHeader>
        {!program ? (
          <LoadingState />
        ) : program.termsContent || program.pdfUrl ? (
          <div className="space-y-4">
            {program.termsContent && <div className="text-sm text-gray-700 whitespace-pre-wrap">{program.termsContent}</div>}
            {program.pdfUrl && (
              <a href={program.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#F58220] underline">
                Abrir regulamento em PDF →
              </a>
            )}
          </div>
        ) : (
          <EmptyState message="Nenhum regulamento cadastrado ainda." />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ManagerGrowthView() {
  const { summary, isLoading, reload } = useSummary()

  return (
    <Tabs defaultValue="ranking">
      <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <TabsTrigger value="ranking" className="flex-shrink-0">Ranking</TabsTrigger>
        <TabsTrigger value="promotions" className="flex-shrink-0">Promoções</TabsTrigger>
        <TabsTrigger value="levels" className="flex-shrink-0">Trilha de Cargos</TabsTrigger>
        <TabsTrigger value="rewards" className="flex-shrink-0">Loja de Prêmios</TabsTrigger>
        <TabsTrigger value="redemptions" className="flex-shrink-0">Resgates</TabsTrigger>
      </TabsList>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
        <TabsContent value="ranking">
          {isLoading || !summary ? (
            <LoadingState />
          ) : summary.leaderboard.length === 0 ? (
            <EmptyState message="Nenhum colaborador com Pts registrado ainda." />
          ) : (
            <div className="space-y-1">
              {summary.leaderboard.map((r) => {
                const podium = PODIUM_STYLES[r.rank as 1 | 2 | 3]
                return (
                  <div
                    key={r.employeeId}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-xl border-b border-gray-50 last:border-0 ${podium ? podium.rowClass : ""}`}
                  >
                    <span className="text-sm font-medium text-[#3E2415] flex items-center gap-2">
                      {podium ? (
                        <span className={`text-lg leading-none ${podium.textClass}`}>{podium.medal}</span>
                      ) : (
                        <span className="text-xs text-gray-400 w-5 text-center">#{r.rank}</span>
                      )}
                      {r.name}
                    </span>
                    <span className={`text-sm font-bold ${podium ? podium.textClass : "text-[#F58220]"}`}>{r.xpPoints} Pts</span>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="promotions">
          <PromotionsEligibleTab />
        </TabsContent>

        <TabsContent value="levels">
          <LevelsTab levels={summary?.levels ?? []} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="rewards">
          <RewardsTab />
        </TabsContent>

        <TabsContent value="redemptions">
          <RedemptionsTab />
        </TabsContent>
      </div>
    </Tabs>
  )
}

type EligiblePromotion = {
  employeeId: string
  name: string
  currentLevelName: string
  xpPoints: number
  monthsInRole: number
  nextLevel: { id: string; name: string; pointsRequired: number }
}

function PromotionsEligibleTab() {
  const [eligible, setEligible] = useState<EligiblePromotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<EligiblePromotion[]>("/api/company/gamification/promotion-eligible").then(setEligible).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleApply = async (e: EligiblePromotion) => {
    if (!confirm(`Aplicar a promoção de ${e.name} para ${e.nextLevel.name}? Ele(a) receberá uma notificação para aceitar.`)) return
    setApplyingId(e.employeeId)
    await adminFetch(`/api/company/gamification/promotion-eligible/${e.employeeId}/apply`, { method: "POST" })
      .then(reload)
      .catch((err) => alert(err instanceof AdminApiError ? err.message : "Erro ao aplicar promoção"))
      .finally(() => setApplyingId(null))
  }

  if (isLoading) return <LoadingState />
  if (eligible.length === 0)
    return <EmptyState message="Nenhum colaborador elegível para promoção no momento (pontuação e/ou tempo mínimo no cargo ainda não atingidos)." />

  return (
    <div className="grid gap-2">
      {eligible.map((e) => (
        <div key={e.employeeId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-gray-100">
          <div>
            <p className="font-medium text-[#3E2415] text-sm">{e.name}</p>
            <p className="text-xs text-gray-500">
              {e.currentLevelName} → {e.nextLevel.name} · {e.xpPoints}/{e.nextLevel.pointsRequired} pts · {e.monthsInRole} meses no cargo
            </p>
          </div>
          <Button size="sm" variant="brand" disabled={applyingId === e.employeeId} onClick={() => handleApply(e)} className="flex-shrink-0">
            Aplicar Promoção
          </Button>
        </div>
      ))}
    </div>
  )
}

function LevelsTab({ levels, isLoading }: { levels: Level[]; isLoading: boolean }) {
  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500">A régua de cargos é configurada em Programa Interno.</p>
        <Link href="/company/programa-interno">
          <Button size="sm" variant="outline" className="text-[#F2680C] border-[#F2680C]/30">
            <Settings className="h-4 w-4 mr-1" /> Gerenciar níveis
          </Button>
        </Link>
      </div>
      {levels.length === 0 ? (
        <EmptyState message="Nenhum nível cadastrado. Configure a régua em Programa Interno." />
      ) : (
        <div className="grid gap-2">
          {levels.map((l) => (
            <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: l.badgeColorHex }} />
                <div>
                  <p className="font-medium text-[#3E2415] text-sm">{l.name}</p>
                  <p className="text-xs text-gray-500">{l.pointsRequired} pontos necessários {l.bonusDescription && `· ${l.bonusDescription}`}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RewardsTab() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Reward[]>("/api/company/gamification/rewards").then(setRewards).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleToggleActive = async (reward: Reward) => {
    await adminFetch(`/api/company/gamification/rewards/${reward.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !reward.active }),
    })
    reload()
  }

  const handleDelete = async (reward: Reward) => {
    if (!confirm(`Excluir o prêmio "${reward.name}"?`)) return
    await adminFetch(`/api/company/gamification/rewards/${reward.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-1" /> Novo Prêmio
        </Button>
      </div>
      {rewards.length === 0 ? (
        <EmptyState message="Nenhum prêmio cadastrado ainda." />
      ) : (
        <div className="grid gap-2">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
              <div>
                <p className="font-medium text-[#3E2415] text-sm">
                  {r.name} <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
                </p>
                <p className="text-xs text-gray-500">{r.costXp} Pts {r.stock !== null && `· estoque ${r.stock}`}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleToggleActive(r)}>
                  <Package className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(r)} className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isCreateOpen && (
        <RewardDialog
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function RewardDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [costXp, setCostXp] = useState("100")
  const [stock, setStock] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("name", name)
      body.append("description", description)
      body.append("costXp", costXp)
      if (stock) body.append("stock", stock)
      await adminFetch("/api/company/gamification/rewards", { method: "POST", body })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar prêmio")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Prêmio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Custo em Pts</Label>
              <Input type="number" value={costXp} onChange={(e) => setCostXp(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Estoque (vazio = ilimitado)</Label>
              <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RedemptionsTab() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Redemption[]>("/api/company/gamification/redemptions").then(setRedemptions).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleReview = async (redemption: Redemption, status: "APPROVED" | "REJECTED" | "DELIVERED") => {
    await adminFetch(`/api/company/gamification/redemptions/${redemption.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  if (isLoading) return <LoadingState />
  if (redemptions.length === 0) return <EmptyState message="Nenhum resgate solicitado ainda." />

  return (
    <div className="space-y-2">
      {redemptions.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
          <div>
            <p className="font-medium text-[#3E2415] text-sm">
              {r.employee.name} → {r.item.name}
            </p>
            <p className="text-xs text-gray-500">{r.costXp} Pts · {new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={r.status} />
            {r.status === "PENDING" && (
              <>
                <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleReview(r, "APPROVED")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleReview(r, "REJECTED")}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {r.status === "APPROVED" && (
              <Button variant="ghost" size="sm" onClick={() => handleReview(r, "DELIVERED")}>
                Marcar entregue
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
