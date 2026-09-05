"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, TrendingUp, Boxes, Trophy, Star, AlertTriangle, Clock, DollarSign, Target, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { PeriodFilter } from "@/components/admin/admin-filters"
import { AdminCard, MetricRow, LoadingState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type Medal = { stars: 1 | 2 | 3 | 4 | 5; label: string; colorHex: string; efficiencyPercent: number }

type DashboardData = {
  companyName: string
  partners: {
    activePartners: number
    pendingCommissions: { total: number; count: number }
    pendingWithdrawals: { total: number; count: number }
    topPartners: { partnerId: string; name: string; total: number }[]
  }
  operations: {
    totalEmployees: number
    presentToday: number
    attendanceRate: number
    executedChecklists: number
    onTimeChecklists: number
    lateOrFailedChecklists: number
    pendingChecklists: number
    occurrencesThisMonth: number
  }
  me: {
    xpPoints: number
    todayXp: number
    monthlyScore: number
    dailyEfficiencyPercent: number
    medal: Medal
    rank: number
    totalRanked: number
    currentLevel: { name: string; requiredXp: number; badgeColorHex: string } | null
    nextLevel: { name: string; requiredXp: number; badgeColorHex: string } | null
    progressToNextPercent: number
  } | null
  master: {
    shiftClosingToday: {
      status: string
      overdue: boolean
      revenueAmount: number | null
      isMasterOverride: boolean
      closedByName: string | null
    } | null
    realRevenue: number
    occurrenceCost: number
    riskEmployees: { id: string; name: string; monthlyScore: number; recentFlags: number }[]
  } | null
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function CompanyDashboardPage() {
  const user = useCompanyUser()
  const [period, setPeriod] = useState("month")
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<DashboardData>(`/api/company/dashboard?period=${period}`)
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [period])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Dashboard da Empresa</h1>
          <p className="text-gray-600 mt-1 text-sm">{user.companyName} — visão gerencial unificada</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          {data.master && <MasterPanel master={data.master} />}
          {data.me && <EmployeeGamePanel me={data.me} />}

          <GoalProgressWidget isManager={canManageDailyOperations(user.role)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminCard title="Parceiros" icon={Users}>
              <MetricRow label="Parceiros ativos no programa" value={data.partners.activePartners} />
              <MetricRow
                label="Comissões pendentes"
                value={`${currency(data.partners.pendingCommissions.total)} (${data.partners.pendingCommissions.count})`}
              />
              <MetricRow
                label="Saques solicitados"
                value={`${currency(data.partners.pendingWithdrawals.total)} (${data.partners.pendingWithdrawals.count})`}
              />
            </AdminCard>

            <AdminCard title="Operação & RH" icon={Boxes}>
              <MetricRow label="Colaboradores" value={data.operations.totalEmployees} />
              <MetricRow
                label="Presença hoje"
                value={`${data.operations.presentToday}/${data.operations.totalEmployees} (${data.operations.attendanceRate}%)`}
              />
              <MetricRow label="Checklists no prazo (mês)" value={data.operations.onTimeChecklists} />
              <MetricRow label="Atrasados/reprovados (mês)" value={data.operations.lateOrFailedChecklists} />
              <MetricRow label="Pendentes de execução" value={data.operations.pendingChecklists} />
              <MetricRow label="Ocorrências no mês" value={data.operations.occurrencesThisMonth} />
            </AdminCard>
          </div>

          <AdminCard title="Top 5 Parceiros da Empresa" icon={TrendingUp}>
            {data.partners.topPartners.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Sem comissões aprovadas no período.</p>
            ) : (
              <div className="space-y-1">
                {data.partners.topPartners.map((p, index) => (
                  <MetricRow key={p.partnerId} label={`${index + 1}. ${p.name}`} value={currency(p.total)} />
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  )
}

function MasterPanel({ master }: { master: NonNullable<DashboardData["master"]> }) {
  const closing = master.shiftClosingToday
  const showAlert = closing && closing.status !== "COMPLETED" && closing.overdue

  return (
    <div className="space-y-4">
      {showAlert && (
        <Link
          href="/company/fechamento"
          className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">Fechamento de hoje está PENDENTE_MASTER</p>
            <p className="text-xs text-red-600">O horário-limite da Gerente estourou — clique para assumir o encerramento.</p>
          </div>
        </Link>
      )}
      {closing?.status === "COMPLETED" && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-800">
          <Clock className="h-4 w-4 flex-shrink-0" />
          Fechamento de hoje concluído{closing.isMasterOverride && ` (assumido pelo Master)`}
          {closing.revenueAmount !== null && ` — Faturamento: ${currency(closing.revenueAmount)}`}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdminCard title="Faturamento Real (fechamentos)" icon={DollarSign}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(master.realRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">Soma dos fechamentos de caixa no período</p>
        </AdminCard>
        <AdminCard title="Custo Operacional de Ocorrências" icon={AlertTriangle}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(master.occurrenceCost)}</p>
          <p className="text-xs text-gray-500 mt-1">Vales, diárias, quebras de caixa e metas batidas</p>
        </AdminCard>
      </div>

      {master.riskEmployees.length > 0 && (
        <AdminCard title="Mapa de Riscos de RH" icon={AlertTriangle}>
          <div className="space-y-1">
            {master.riskEmployees.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-[#3E2415]">{e.name}</span>
                <span className="text-xs text-red-600 font-medium">
                  Score mensal {e.monthlyScore} · {e.recentFlags} ocorrência(s) recente(s)
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  )
}

function EfficiencyMedal({ medal }: { medal: Medal }) {
  return (
    <div className="flex items-center gap-1" title={`${medal.label} — ${medal.efficiencyPercent}% de eficiência hoje`}>
      {Array.from({ length: medal.stars }).map((_, i) => (
        <Star key={i} className="h-4 w-4" fill={medal.colorHex} color={medal.colorHex} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{medal.label}</span>
    </div>
  )
}

function EmployeeGamePanel({ me }: { me: NonNullable<DashboardData["me"]> }) {
  const [pulse, setPulse] = useState<{ delta: number } | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    adminFetch<{ delta: number; entries: unknown[] }>("/api/company/gamification/xp-pulse").then((res) => {
      if (res.delta !== 0) setPulse({ delta: res.delta })
    })
  }, [])

  useEffect(() => {
    if (!pulse) return
    const timer = setTimeout(() => setPulse(null), 4000)
    return () => clearTimeout(timer)
  }, [pulse])

  return (
    <div className="relative">
      {pulse && (
        <div
          className={`absolute -top-3 right-4 z-10 px-4 py-2 rounded-full text-white font-bold text-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-500 ${
            pulse.delta >= 0 ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {pulse.delta >= 0 ? "+" : ""}
          {pulse.delta} XP
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-[#3E2415]">Meu Progresso</h3>
          </div>
          <EfficiencyMedal medal={me.medal} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Nível atual</p>
            <p className="text-sm font-bold text-[#3E2415]">{me.currentLevel?.name ?? "Sem nível"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">XP total</p>
            <p className="text-sm font-bold text-[#3E2415]">{me.xpPoints}</p>
          </div>
          <div>
            <button onClick={() => setShowHistory(true)} className="text-left">
              <p className="text-xs text-gray-500">Pontos do mês</p>
              <p className="text-sm font-bold text-[#F58220] underline decoration-dotted">{me.monthlyScore}</p>
            </button>
          </div>
          <div>
            <p className="text-xs text-gray-500">XP hoje</p>
            <p className={`text-sm font-bold ${me.todayXp >= 0 ? "text-green-600" : "text-red-600"}`}>
              {me.todayXp >= 0 ? "+" : ""}
              {me.todayXp}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Ranking interno</p>
            <p className="text-sm font-bold text-[#3E2415]">
              #{me.rank} de {me.totalRanked}
            </p>
          </div>
        </div>

        {me.nextLevel && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Progresso para {me.nextLevel.name}</span>
              <span>{me.progressToNextPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full transition-all"
                style={{ width: `${me.progressToNextPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {showHistory && <XpHistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  )
}

type XpEntryRow = { id: string; reason: string; points: number; note: string | null; createdAt: string }
const XP_REASON_LABELS: Record<string, string> = {
  ATTENDANCE: "Ponto Digital",
  CHECKLIST_ON_TIME: "Checklist",
  DAILY_EVALUATION: "Nota diária",
  OCCURRENCE_PENALTY: "Ocorrência",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  REWARD_REDEMPTION: "Resgate de prêmio",
}

function XpHistoryModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ monthlyScore: number; entries: XpEntryRow[] } | null>(null)

  useEffect(() => {
    adminFetch<{ monthlyScore: number; entries: XpEntryRow[] }>("/api/company/gamification/xp-history").then(setData)
  }, [])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extrato de Pontos do Mês</DialogTitle>
        </DialogHeader>
        {!data ? (
          <LoadingState />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Saldo do mês (30 base + lançamentos): <span className="font-bold text-[#3E2415]">{data.monthlyScore}</span>
            </p>
            {data.entries.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Nenhum lançamento este mês ainda.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.entries.map((entry) => (
                  <div key={entry.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#3E2415]">{XP_REASON_LABELS[entry.reason] ?? entry.reason}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.createdAt).toLocaleString("pt-BR")}
                        {entry.note && ` · ${entry.note}`}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${entry.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {entry.points >= 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type GoalTier = { id: string; order: number; targetAmount: string; bonusAmount: string }
type GoalProgress = {
  currentRevenue: number
  tiers: GoalTier[]
  currentTier: GoalTier | null
  nextTier: GoalTier | null
  progressToNextPercent: number
  remainingToNext: number
}

function GoalProgressWidget({ isManager }: { isManager: boolean }) {
  const [progress, setProgress] = useState<GoalProgress | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  const reload = () => {
    adminFetch<GoalProgress>("/api/company/goals/progress").then(setProgress)
  }
  useEffect(reload, [])

  if (!progress) return null
  if (progress.tiers.length === 0 && !isManager) return null

  return (
    <AdminCard title="Meta do Dia" icon={Target}>
      {progress.tiers.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">Nenhuma faixa de meta configurada ainda.</p>
          {isManager && (
            <Button size="sm" variant="outline" onClick={() => setIsConfigOpen(true)}>
              Configurar Metas
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-[#3E2415]">{currency(progress.currentRevenue)}</p>
            {isManager && (
              <Button size="sm" variant="ghost" onClick={() => setIsConfigOpen(true)}>
                Configurar
              </Button>
            )}
          </div>
          {progress.nextTier ? (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Faltam {currency(progress.remainingToNext)} para {currency(Number(progress.nextTier.targetAmount))} — bônus de{" "}
                  {currency(Number(progress.nextTier.bonusAmount))}
                </span>
                <span>{progress.progressToNextPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full transition-all"
                  style={{ width: `${progress.progressToNextPercent}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-green-600">Todas as faixas de meta foram batidas hoje! 🎉</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {progress.tiers.map((t) => (
              <span
                key={t.id}
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  progress.currentTier && t.order <= progress.currentTier.order
                    ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {currency(Number(t.targetAmount))} → {currency(Number(t.bonusAmount))}
              </span>
            ))}
          </div>
        </div>
      )}

      {isConfigOpen && (
        <GoalsConfigDialog
          tiers={progress.tiers}
          onClose={() => setIsConfigOpen(false)}
          onChanged={() => {
            reload()
          }}
        />
      )}
    </AdminCard>
  )
}

function GoalsConfigDialog({ tiers, onClose, onChanged }: { tiers: GoalTier[]; onClose: () => void; onChanged: () => void }) {
  const [targetAmount, setTargetAmount] = useState("")
  const [bonusAmount, setBonusAmount] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/goals", { method: "POST", body: JSON.stringify({ targetAmount, bonusAmount }) })
      setTargetAmount("")
      setBonusAmount("")
      onChanged()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar meta")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    await adminFetch(`/api/company/goals/${id}`, { method: "DELETE" }).catch(() => {})
    onChanged()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Metas Escalonadas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {tiers.length > 0 && (
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100">
                  <span className="text-sm text-[#3E2415]">
                    {currency(Number(t.targetAmount))} → bônus {currency(Number(t.bonusAmount))}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t border-gray-100">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Meta de faturamento (R$)</Label>
                <Input type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Bônus (R$)</Label>
                <Input type="number" step="0.01" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting} size="sm" className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
            </Button>
          </form>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
