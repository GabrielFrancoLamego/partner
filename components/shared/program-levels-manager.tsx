"use client"

import { useState } from "react"
import { Plus, Trash2, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { EmptyState, LoadingState } from "@/components/admin/admin-ui"

export type LevelCriteria = "REFERRAL_COUNT" | "REVENUE" | "BOTH"
export type BenefitType = "PERCENTAGE" | "FIXED" | "BOTH"
export type MeasurementUnit = "ALL_TIME" | "DAYS" | "MONTHS"

export type ProgramLevel = {
  id: string
  name: string
  order: number
  criteria: LevelCriteria
  requiredReferralCount: number
  requiredRevenueAmount: string | null
  measurementUnit: MeasurementUnit
  periodMonths: number
  benefitType: BenefitType
  commissionPercentage: string
  bonusFixedAmount: string | null
  bonusDescription: string | null
  badgeColorHex: string
}

export type ProgramLevelInput = {
  name: string
  criteria: LevelCriteria
  requiredReferralCount?: number
  requiredRevenueAmount?: number
  measurementUnit: MeasurementUnit
  periodMonths?: number
  benefitType: BenefitType
  commissionPercentage?: number
  bonusFixedAmount?: number
  bonusDescription?: string
  badgeColorHex: string
}

const CRITERIA_LABELS: Record<LevelCriteria, string> = {
  REFERRAL_COUNT: "Qtd. de Indicações",
  REVENUE: "Faturamento Gerado",
  BOTH: "Indicações + Faturamento",
}
const BENEFIT_LABELS: Record<BenefitType, string> = {
  PERCENTAGE: "% extra de comissão",
  FIXED: "Bônus fixo (R$)",
  BOTH: "% + Bônus fixo",
}

/**
 * Régua de Níveis de Crescimento (Prata/Ouro/Diamante) — usada tanto em
 * /company/programas quanto na aba Programas do Admin, sempre contra um
 * `programId` já existente. O chamador injeta `onCreate`/`onDelete` ligados
 * ao endpoint correto (empresa vê só o próprio programa; Admin escolhe
 * qualquer um).
 */
export function ProgramLevelsManager({
  levels,
  isLoading,
  onCreate,
  onDelete,
}: {
  levels: ProgramLevel[]
  isLoading: boolean
  onCreate: (input: ProgramLevelInput) => Promise<void>
  onDelete: (level: ProgramLevel) => Promise<void>
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Níveis de comissão progressiva — ex: Prata → Ouro → Diamante.</p>
        <Button size="sm" variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Nível
        </Button>
      </div>

      {levels.length === 0 ? (
        <EmptyState message="Nenhum nível cadastrado ainda." />
      ) : (
        <div className="grid gap-2">
          {levels.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
              <span className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: l.badgeColorHex }}>
                <Trophy className="h-4 w-4 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#3E2415] text-sm">{l.name}</p>
                <p className="text-xs text-gray-500">
                  {l.criteria !== "REVENUE" && `${l.requiredReferralCount} indicações`}
                  {l.criteria === "BOTH" && " + "}
                  {l.criteria !== "REFERRAL_COUNT" && l.requiredRevenueAmount && `R$ ${l.requiredRevenueAmount} faturados`}
                  {l.measurementUnit !== "ALL_TIME" && ` · reavaliado a cada ${l.periodMonths} meses`}
                  {l.benefitType !== "FIXED" && ` · +${l.commissionPercentage}% comissão`}
                  {l.benefitType !== "PERCENTAGE" && l.bonusFixedAmount && ` · +R$${l.bonusFixedAmount}`}
                </p>
              </div>
              <button onClick={() => onDelete(l)} className="text-red-400 hover:text-red-700 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && <LevelDialog onClose={() => setIsCreateOpen(false)} onCreate={onCreate} />}
    </div>
  )
}

function LevelDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: ProgramLevelInput) => Promise<void> }) {
  const [name, setName] = useState("")
  const [criteria, setCriteria] = useState<LevelCriteria>("REFERRAL_COUNT")
  const [requiredReferralCount, setRequiredReferralCount] = useState("10")
  const [requiredRevenueAmount, setRequiredRevenueAmount] = useState("")
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("ALL_TIME")
  const [periodMonths, setPeriodMonths] = useState("12")
  const [benefitType, setBenefitType] = useState<BenefitType>("PERCENTAGE")
  const [commissionPercentage, setCommissionPercentage] = useState("")
  const [bonusFixedAmount, setBonusFixedAmount] = useState("")
  const [bonusDescription, setBonusDescription] = useState("")
  const [badgeColorHex, setBadgeColorHex] = useState("#C0C0C0")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (measurementUnit !== "ALL_TIME" && !periodMonths) {
      setError("Informe o período de mensuração em meses")
      return
    }
    setIsSubmitting(true)
    try {
      await onCreate({
        name,
        criteria,
        requiredReferralCount: criteria !== "REVENUE" ? Number(requiredReferralCount) : undefined,
        requiredRevenueAmount: criteria !== "REFERRAL_COUNT" ? Number(requiredRevenueAmount) : undefined,
        measurementUnit,
        periodMonths: measurementUnit !== "ALL_TIME" ? Number(periodMonths) : 0,
        benefitType,
        commissionPercentage: benefitType !== "FIXED" ? Number(commissionPercentage) : undefined,
        bonusFixedAmount: benefitType !== "PERCENTAGE" ? Number(bonusFixedAmount) : undefined,
        bonusDescription: bonusDescription || undefined,
        badgeColorHex,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar nível")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Nível de Crescimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome do nível (ex: Prata, Ouro, Diamante)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Critério de elevação</Label>
            <Select value={criteria} onValueChange={(v) => setCriteria(v as LevelCriteria)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CRITERIA_LABELS) as LevelCriteria[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CRITERIA_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {criteria !== "REVENUE" && (
              <div className="space-y-2">
                <Label>Qtd. de indicações</Label>
                <Input type="number" value={requiredReferralCount} onChange={(e) => setRequiredReferralCount(e.target.value)} required />
              </div>
            )}
            {criteria !== "REFERRAL_COUNT" && (
              <div className="space-y-2">
                <Label>Faturamento gerado (R$)</Label>
                <Input type="number" step="0.01" value={requiredRevenueAmount} onChange={(e) => setRequiredRevenueAmount(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Período de mensuração (manutenção do nível)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={measurementUnit} onValueChange={(v) => setMeasurementUnit(v as MeasurementUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_TIME">Todo o período (nunca rebaixa)</SelectItem>
                  <SelectItem value="MONTHS">XX meses</SelectItem>
                </SelectContent>
              </Select>
              {measurementUnit !== "ALL_TIME" && (
                <Input type="number" value={periodMonths} onChange={(e) => setPeriodMonths(e.target.value)} placeholder="ex: 12" required />
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Benefício do nível</Label>
            <Select value={benefitType} onValueChange={(v) => setBenefitType(v as BenefitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BENEFIT_LABELS) as BenefitType[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BENEFIT_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {benefitType !== "FIXED" && (
              <div className="space-y-2">
                <Label>Aumento da comissão base (%)</Label>
                <Input type="number" step="0.1" value={commissionPercentage} onChange={(e) => setCommissionPercentage(e.target.value)} required />
              </div>
            )}
            {benefitType !== "PERCENTAGE" && (
              <div className="space-y-2">
                <Label>Bônus fixo (R$)</Label>
                <Input type="number" step="0.01" value={bonusFixedAmount} onChange={(e) => setBonusFixedAmount(e.target.value)} required />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Bônus associado (descrição livre)</Label>
            <Input value={bonusDescription} onChange={(e) => setBonusDescription(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Cor do selo</Label>
            <Input type="color" value={badgeColorHex} onChange={(e) => setBadgeColorHex(e.target.value)} className="h-10 w-20" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
