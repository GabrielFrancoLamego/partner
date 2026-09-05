"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Trophy, Gift, Plus, Trash2, Check, X, Package, Settings } from "lucide-react"
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

type Level = { id: string; name: string; order: number; pointsRequired: number; bonusDescription: string | null; badgeColorHex: string; imageUrl: string | null }
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
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-[#3E2415]">Minha Trilha</h3>
        </div>
        <p className="text-2xl font-bold text-[#3E2415]">{me?.currentLevel?.name ?? "Sem nível ainda"}</p>
        <p className="text-sm text-gray-500 mb-3">{me?.xpPoints ?? 0} XP acumulado</p>
        {me?.nextLevel && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Rumo a {me.nextLevel.name}</span>
              <span>{me.progressToNextPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full"
                style={{ width: `${me.progressToNextPercent}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          {summary.levels.map((l) => (
            <span
              key={l.id}
              className="text-xs font-medium px-3 py-1 rounded-full text-white"
              style={{ backgroundColor: l.badgeColorHex, opacity: me?.currentLevel && l.order <= me.currentLevel.order ? 1 : 0.4 }}
            >
              {l.name}
            </span>
          ))}
        </div>
      </div>

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
