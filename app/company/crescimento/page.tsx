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
import { canManageDailyOperations } from "@/lib/permissions"

type Level = {
  id: string
  name: string
  order: number
  pointsRequired: number
  bonusDescription: string | null
  badgeColorHex: string
  imageUrl: string | null
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa de Crescimento</h1>
        <p className="text-gray-600 mt-1 text-sm">Trilha de cargos, XP e loja de prêmios</p>
      </div>
      {isManager ? <ManagerGrowthView /> : <EmployeeGrowthView />}
    </div>
  )
}

type Summary = {
  levels: Level[]
  leaderboard: LeaderboardRow[]
  me: { xpPoints: number; progressToNextPercent: number; currentLevel: Level | null; nextLevel: Level | null } | null
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
                className={`relative w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all ${
                  isCurrent ? "scale-110 shadow-lg" : ""
                }`}
                style={{
                  backgroundColor: unlocked ? l.badgeColorHex : "#F3F4F6",
                  borderColor: isCurrent ? "#FFC800" : "transparent",
                }}
              >
                {unlocked ? (
                  <Trophy className="h-5 w-5 text-white" />
                ) : (
                  <Lock className="h-4 w-4 text-gray-400" />
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
    "Bata o ponto dentro do horário todos os dias — cada check-in em dia soma XP.",
    "Entregue os checklists antes do prazo, com foto quando exigido.",
    "Mantenha boas notas na Avaliação Diária da Gerência.",
    "Evite ocorrências (faltas, advertências) — elas descontam XP.",
  ]
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold text-[#3E2415]">
          Faltam {missing} XP para {me.nextLevel.name}
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

type ServiceFeeAdjustment = { type: "PENALTY" | "BONUS"; percentage: number | null; fixedAmount: number | null } | null
type XpHistoryResponse = { monthlyScore: number; basePoints: number; entries: XpEntry[]; serviceFeeAdjustment: ServiceFeeAdjustment }

function useXpHistory() {
  const [data, setData] = useState<XpHistoryResponse | null>(null)
  useEffect(() => {
    adminFetch<XpHistoryResponse>("/api/company/gamification/xp-history").then(setData)
  }, [])
  return data
}

/** Card de Pontuação Mensal — pontos do mês corrente (base + eventos) e a faixa de Taxa de Serviço que isso rende. */
function MonthlyScoreCard() {
  const data = useXpHistory()
  if (!data) return null

  const percent = data.basePoints > 0 ? Math.max(0, Math.min(100, Math.round((data.monthlyScore / data.basePoints) * 100))) : 0
  const { serviceFeeAdjustment: fee } = data

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center">
          <Gauge className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-base font-bold text-[#3E2415]">Pontuação Mensal</h3>
      </div>

      <div className="flex items-end gap-1.5 mb-2">
        <span className="text-3xl font-bold text-[#3E2415]">{data.monthlyScore}</span>
        <span className="text-sm text-gray-400 mb-1">/ {data.basePoints} pts</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${data.monthlyScore < 0 ? "bg-red-500" : "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800]"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {fee ? (
        <div className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${fee.type === "BONUS" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {fee.type === "BONUS" ? <TrendingUp className="h-4 w-4 flex-shrink-0" /> : <TrendingDown className="h-4 w-4 flex-shrink-0" />}
          <span>
            Com essa pontuação, você está {fee.type === "BONUS" ? "ganhando um bônus" : "com uma perda"} na Taxa de Serviço deste mês:{" "}
            {fee.percentage ? `${fee.percentage}%` : ""}
            {fee.percentage && fee.fixedAmount ? " + " : ""}
            {fee.fixedAmount ? `R$ ${fee.fixedAmount}` : ""}
          </span>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Nenhuma faixa de Taxa de Serviço atingida com a pontuação atual.</p>
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
        <p className="text-xs text-gray-400">Nenhuma medalha ainda — comece a acumular XP!</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {unlockedLevels.map((l) => (
            <div key={l.id} className="flex flex-col items-center gap-1 w-16">
              {l.imageUrl ? (
                <img src={l.imageUrl} alt={l.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: l.badgeColorHex }}>
                  <Trophy className="h-4 w-4 text-white" />
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

  const reloadRewards = () => {
    adminFetch<Reward[]>("/api/company/gamification/rewards").then(setRewards)
    adminFetch<Redemption[]>("/api/company/gamification/redemptions").then(setRedemptions)
  }
  useEffect(reloadRewards, [])

  const handleRedeem = async (reward: Reward) => {
    if (!confirm(`Resgatar "${reward.name}" por ${reward.costXp} XP?`)) return
    await adminFetch(`/api/company/gamification/rewards/${reward.id}/redeem`, { method: "POST" })
      .then(() => {
        reload()
        reloadRewards()
      })
      .catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao resgatar"))
  }

  if (isLoading || !summary) return <LoadingState />
  const me = summary.me

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-[#3E2415]">Mapa de Evolução</h3>
        </div>
        <p className="text-2xl font-bold text-[#3E2415]">{me?.currentLevel?.name ?? "Sem nível ainda"}</p>
        <p className="text-sm text-gray-500 mb-4">{me?.xpPoints ?? 0} XP acumulado</p>

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

      <AdminCard title="Loja de Prêmios" icon={Gift}>
        {rewards.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhum prêmio disponível no momento.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {rewards.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#3E2415] text-sm truncate">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.costXp} XP {r.stock !== null && `· ${r.stock} disponíveis`}</p>
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
        )}
      </AdminCard>

      <AdminCard title="Meus Resgates">
        {redemptions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhum resgate ainda.</p>
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-[#3E2415]">{r.item.name}</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

function ManagerGrowthView() {
  const { summary, isLoading, reload } = useSummary()

  return (
    <Tabs defaultValue="ranking">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="ranking">Ranking</TabsTrigger>
        <TabsTrigger value="levels">Trilha de Cargos</TabsTrigger>
        <TabsTrigger value="rewards">Loja de Prêmios</TabsTrigger>
        <TabsTrigger value="redemptions">Resgates</TabsTrigger>
      </TabsList>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
        <TabsContent value="ranking">
          {isLoading || !summary ? (
            <LoadingState />
          ) : summary.leaderboard.length === 0 ? (
            <EmptyState message="Nenhum colaborador com XP registrado ainda." />
          ) : (
            <div className="space-y-1">
              {summary.leaderboard.map((r) => (
                <div key={r.employeeId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-medium text-[#3E2415]">
                    #{r.rank} {r.name}
                  </span>
                  <span className="text-sm font-bold text-[#F58220]">{r.xpPoints} XP</span>
                </div>
              ))}
            </div>
          )}
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
                <p className="text-xs text-gray-500">{r.costXp} XP {r.stock !== null && `· estoque ${r.stock}`}</p>
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
              <Label>Custo em XP</Label>
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
            <p className="text-xs text-gray-500">{r.costXp} XP · {new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
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
