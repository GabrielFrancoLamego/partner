"use client"

import { useState } from "react"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { EmptyState, LoadingState } from "@/components/admin/admin-ui"
import { MedalGlyph, MedalPicker, type MedalIconKey } from "@/components/shared/medal-picker"
import { MEASUREMENT_PRESET_LABELS, toMeasurementPreset, fromMeasurementPreset, type MeasurementPreset, type MeasurementUnit } from "@/lib/level-measurement"

export type LevelCriteria = "REFERRAL_COUNT" | "REVENUE" | "BOTH"
export type BenefitType = "PERCENTAGE" | "FIXED" | "BOTH"
export type { MeasurementUnit }

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
  medalIcon: MedalIconKey
  imageUrl: string | null
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
  medalIcon: MedalIconKey
  imageUrl?: string | null
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
 * `programId` já existente. O chamador injeta `onCreate`/`onUpdate`/`onDelete`
 * ligados ao endpoint correto (empresa vê só o próprio programa; Admin escolhe
 * qualquer um).
 */
export function ProgramLevelsManager({
  levels,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  uploadEndpoint = "/api/company/uploads",
}: {
  levels: ProgramLevel[]
  isLoading: boolean
  onCreate: (input: ProgramLevelInput) => Promise<void>
  onUpdate?: (level: ProgramLevel, input: ProgramLevelInput) => Promise<void>
  onDelete: (level: ProgramLevel) => Promise<void>
  uploadEndpoint?: string
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ProgramLevel | null>(null)

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
              <span
                className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: l.badgeColorHex }}
              >
                {l.imageUrl ? (
                  <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <MedalGlyph medalIcon={l.medalIcon === "CUSTOM" ? "GOLD" : l.medalIcon} className="h-4 w-4 text-white" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#3E2415] text-sm">{l.name}</p>
                <p className="text-xs text-gray-500">
                  {l.criteria !== "REVENUE" && `${l.requiredReferralCount} indicações`}
                  {l.criteria === "BOTH" && " + "}
                  {l.criteria !== "REFERRAL_COUNT" && l.requiredRevenueAmount && `R$ ${l.requiredRevenueAmount} faturados`}
                  {l.measurementUnit !== "ALL_TIME" && ` · ${MEASUREMENT_PRESET_LABELS[toMeasurementPreset(l.measurementUnit, l.periodMonths)]}`}
                  {l.benefitType !== "FIXED" && ` · +${l.commissionPercentage}% comissão`}
                  {l.benefitType !== "PERCENTAGE" && l.bonusFixedAmount && ` · +R$${l.bonusFixedAmount}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {onUpdate && (
                  <button onClick={() => setEditing(l)} className="text-gray-400 hover:text-[#F58220] p-1">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => onDelete(l)} className="text-red-400 hover:text-red-700 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <LevelDialog onClose={() => setIsCreateOpen(false)} onSave={onCreate} uploadEndpoint={uploadEndpoint} />
      )}
      {editing && onUpdate && (
        <LevelDialog
          level={editing}
          onClose={() => setEditing(null)}
          onSave={(input) => onUpdate(editing, input)}
          uploadEndpoint={uploadEndpoint}
        />
      )}
    </div>
  )
}

function LevelDialog({
  level,
  onClose,
  onSave,
  uploadEndpoint,
}: {
  level?: ProgramLevel
  onClose: () => void
  onSave: (input: ProgramLevelInput) => Promise<void>
  uploadEndpoint: string
}) {
  const [name, setName] = useState(level?.name ?? "")
  const [criteria, setCriteria] = useState<LevelCriteria>(level?.criteria ?? "REFERRAL_COUNT")
  const [requiredReferralCount, setRequiredReferralCount] = useState(level ? String(level.requiredReferralCount) : "10")
  const [requiredRevenueAmount, setRequiredRevenueAmount] = useState(level?.requiredRevenueAmount ?? "")
  const [measurementPreset, setMeasurementPreset] = useState<MeasurementPreset>(
    level ? toMeasurementPreset(level.measurementUnit, level.periodMonths) : "ALL_TIME",
  )
  const [benefitType, setBenefitType] = useState<BenefitType>(level?.benefitType ?? "PERCENTAGE")
  const [commissionPercentage, setCommissionPercentage] = useState(level?.commissionPercentage ?? "")
  const [bonusFixedAmount, setBonusFixedAmount] = useState(level?.bonusFixedAmount ?? "")
  const [bonusDescription, setBonusDescription] = useState(level?.bonusDescription ?? "")
  const [badgeColorHex, setBadgeColorHex] = useState(level?.badgeColorHex ?? "#C0C0C0")
  const [medalIcon, setMedalIcon] = useState<MedalIconKey>(level?.medalIcon ?? "GOLD")
  const [imageUrl, setImageUrl] = useState<string | null>(level?.imageUrl ?? null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const { unit, value } = fromMeasurementPreset(measurementPreset)
      await onSave({
        name,
        criteria,
        requiredReferralCount: criteria !== "REVENUE" ? Number(requiredReferralCount) : undefined,
        requiredRevenueAmount: criteria !== "REFERRAL_COUNT" ? Number(requiredRevenueAmount) : undefined,
        measurementUnit: unit,
        periodMonths: value,
        benefitType,
        commissionPercentage: benefitType !== "FIXED" ? Number(commissionPercentage) : undefined,
        bonusFixedAmount: benefitType !== "PERCENTAGE" ? Number(bonusFixedAmount) : undefined,
        bonusDescription: bonusDescription || undefined,
        badgeColorHex,
        medalIcon,
        imageUrl,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar nível")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{level ? "Editar Nível de Crescimento" : "Novo Nível de Crescimento"}</DialogTitle>
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
            <Select value={measurementPreset} onValueChange={(v) => setMeasurementPreset(v as MeasurementPreset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEASUREMENT_PRESET_LABELS) as MeasurementPreset[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {MEASUREMENT_PRESET_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Cor do nível (tema/badge do dashboard ao atingir este nível)</Label>
            <Input type="color" value={badgeColorHex} onChange={(e) => setBadgeColorHex(e.target.value)} className="h-10 w-20" />
          </div>

          <MedalPicker
            medalIcon={medalIcon}
            imageUrl={imageUrl}
            badgeColorHex={badgeColorHex}
            onChange={setMedalIcon}
            onImageUploaded={setImageUrl}
            uploadEndpoint={uploadEndpoint}
            uploadKind="program-level-image"
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {level ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
