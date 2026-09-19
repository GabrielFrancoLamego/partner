"use client"

import { useState } from "react"
import { Plus, Trash2, Gauge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminCard } from "@/components/admin/admin-ui"

export type ServiceFeeTierKind = "PERCENTAGE" | "FIXED" | "BOTH"

export type ServiceFeeTier = {
  id: string
  minPoints: number
  maxPoints: number
  kind: ServiceFeeTierKind
  percentage: string | null
  fixedAmount: string | null
}

export type ServiceFeeTierInput = {
  minPoints: number
  maxPoints: number
  kind: ServiceFeeTierKind
  percentage?: number
  fixedAmount?: number
}

const KIND_LABELS: Record<ServiceFeeTierKind, string> = {
  PERCENTAGE: "% da Taxa de Serviço/Comissão",
  FIXED: "Valor Fixo (R$) no Salário",
  BOTH: "Ambas (% + R$ fixo)",
}

function effectSummary(t: ServiceFeeTier) {
  const parts: string[] = []
  if (t.percentage) parts.push(`${Number(t.percentage) > 0 ? "+" : ""}${t.percentage}%`)
  if (t.fixedAmount) parts.push(`${Number(t.fixedAmount) > 0 ? "+" : ""}R$ ${t.fixedAmount}`)
  return parts.join(" · ") || "—"
}

/** Gerenciador de Ranges de Pontuação -> impacto financeiro — /company/programa-interno e aba "Programa Interno" do Admin. */
export function ServiceFeeTiersManager({
  tiers,
  onCreate,
  onDelete,
}: {
  tiers: ServiceFeeTier[]
  onCreate: (input: ServiceFeeTierInput) => Promise<void>
  onDelete: (tier: ServiceFeeTier) => Promise<void>
}) {
  const [minPoints, setMinPoints] = useState("0")
  const [maxPoints, setMaxPoints] = useState("50")
  const [kind, setKind] = useState<ServiceFeeTierKind>("PERCENTAGE")
  const [percentage, setPercentage] = useState("")
  const [fixedAmount, setFixedAmount] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (Number(minPoints) > Number(maxPoints)) {
      setError("A pontuação mínima não pode ser maior que a máxima")
      return
    }
    if (kind !== "FIXED" && !percentage) {
      setError("Informe a % da faixa")
      return
    }
    if (kind !== "PERCENTAGE" && !fixedAmount) {
      setError("Informe o valor fixo (R$) da faixa")
      return
    }
    setIsSubmitting(true)
    try {
      await onCreate({
        minPoints: Number(minPoints),
        maxPoints: Number(maxPoints),
        kind,
        percentage: kind !== "FIXED" ? Number(percentage) : undefined,
        fixedAmount: kind !== "PERCENTAGE" ? Number(fixedAmount) : undefined,
      })
      setPercentage("")
      setFixedAmount("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar faixa")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        Ranges de pontuação final do mês (apuração de 30 dias) que definem o impacto na Taxa de Serviço/Salário — ex:
        0 a 50 pts = -20% Taxa · 51 a 80 = neutro · 81 a 100 = +10% Taxa + R$ 100 bônus.
      </p>

      <AdminCard title="Faixas cadastradas" icon={Gauge}>
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma faixa cadastrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((t) => {
              const positive = (t.percentage ? Number(t.percentage) : 0) + (t.fixedAmount ? Number(t.fixedAmount) : 0) > 0
              const negative = (t.percentage ? Number(t.percentage) : 0) + (t.fixedAmount ? Number(t.fixedAmount) : 0) < 0
              return (
                <div
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    positive ? "border-green-100 bg-green-50" : negative ? "border-red-100 bg-red-50" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <span className={`text-sm ${positive ? "text-green-800" : negative ? "text-red-800" : "text-gray-700"}`}>
                    {t.minPoints} a {t.maxPoints} pts → {effectSummary(t)}
                  </span>
                  <button onClick={() => onDelete(t)} className="text-gray-400 hover:text-red-700 flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </AdminCard>

      <AdminCard title="+ Adicionar Faixa">
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Pontuação mínima do range</Label>
              <Input type="number" value={minPoints} onChange={(e) => setMinPoints(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Pontuação máxima do range</Label>
              <Input type="number" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Tipo de impacto financeiro</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ServiceFeeTierKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as ServiceFeeTierKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {kind !== "FIXED" && (
              <div className="space-y-2">
                <Label className="text-xs">% da faixa (negativo = redução)</Label>
                <Input type="number" step="0.1" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="ex: -20 ou 10" />
              </div>
            )}
            {kind !== "PERCENTAGE" && (
              <div className="space-y-2">
                <Label className="text-xs">Valor fixo (R$) — negativo = redução</Label>
                <Input type="number" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} placeholder="ex: -50 ou 100" />
              </div>
            )}
          </div>
          <Button type="submit" size="sm" variant="brand" disabled={isSubmitting}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Faixa
          </Button>
        </form>
      </AdminCard>
    </div>
  )
}
