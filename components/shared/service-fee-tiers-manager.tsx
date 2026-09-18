"use client"

import { useState } from "react"
import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminCard } from "@/components/admin/admin-ui"

export type ServiceFeeTier = {
  id: string
  type: "PENALTY" | "BONUS"
  thresholdPoints: number
  percentage: string | null
  fixedAmount: string | null
}

export type ServiceFeeTierInput = {
  type: "PENALTY" | "BONUS"
  thresholdPoints: number
  percentage?: number
  fixedAmount?: number
}

/** Faixas de ganho/perda de Taxa de Serviço — /company/programa-interno e aba "Programa Interno" do Admin. */
export function ServiceFeeTiersManager({
  tiers,
  onCreate,
  onDelete,
}: {
  tiers: ServiceFeeTier[]
  onCreate: (input: ServiceFeeTierInput) => Promise<void>
  onDelete: (tier: ServiceFeeTier) => Promise<void>
}) {
  const [type, setType] = useState<"PENALTY" | "BONUS">("PENALTY")
  const [thresholdPoints, setThresholdPoints] = useState("50")
  const [percentage, setPercentage] = useState("")
  const [fixedAmount, setFixedAmount] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!percentage && !fixedAmount) {
      setError("Informe a % ou o valor fixo da faixa")
      return
    }
    setIsSubmitting(true)
    try {
      await onCreate({
        type,
        thresholdPoints: Number(thresholdPoints),
        percentage: percentage ? Number(percentage) : undefined,
        fixedAmount: fixedAmount ? Number(fixedAmount) : undefined,
      })
      setPercentage("")
      setFixedAmount("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar faixa")
    } finally {
      setIsSubmitting(false)
    }
  }

  const penaltyTiers = tiers.filter((t) => t.type === "PENALTY")
  const bonusTiers = tiers.filter((t) => t.type === "BONUS")

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        Faixas aplicadas sobre a Taxa de Serviço com base na pontuação final do mês (apuração de 30 dias) — múltiplas
        faixas de perda e de ganho por empresa.
      </p>

      <AdminCard title="Faixas de Perda" icon={TrendingDown}>
        {penaltyTiers.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma faixa de perda cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {penaltyTiers.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                <span className="text-sm text-red-800">
                  Pontuação ≤ {t.thresholdPoints} → {t.percentage ? `-${t.percentage}%` : ""}
                  {t.percentage && t.fixedAmount ? " e " : ""}
                  {t.fixedAmount ? `-R$${t.fixedAmount}` : ""}
                </span>
                <button onClick={() => onDelete(t)} className="text-red-400 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Faixas de Bônus" icon={TrendingUp}>
        {bonusTiers.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma faixa de bônus cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {bonusTiers.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                <span className="text-sm text-green-800">
                  Pontuação ≥ {t.thresholdPoints} → {t.percentage ? `+${t.percentage}%` : ""}
                  {t.percentage && t.fixedAmount ? " e " : ""}
                  {t.fixedAmount ? `+R$${t.fixedAmount}` : ""}
                </span>
                <button onClick={() => onDelete(t)} className="text-green-500 hover:text-green-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Nova Faixa">
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "PENALTY" | "BONUS")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENALTY">Perda</SelectItem>
                  <SelectItem value="BONUS">Bônus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{type === "PENALTY" ? "Pontuação ≤" : "Pontuação ≥"}</Label>
              <Input type="number" value={thresholdPoints} onChange={(e) => setThresholdPoints(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">% da taxa</Label>
              <Input type="number" step="0.1" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor fixo (R$)</Label>
              <Input type="number" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <Button type="submit" size="sm" variant="brand" disabled={isSubmitting}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Regra de Taxa de Serviço
          </Button>
        </form>
      </AdminCard>
    </div>
  )
}
