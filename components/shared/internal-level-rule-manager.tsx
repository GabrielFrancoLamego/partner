"use client"

import { useState } from "react"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { EmptyState, LoadingState } from "@/components/admin/admin-ui"
import { MedalGlyph, MedalPicker, type MedalIconKey } from "@/components/shared/medal-picker"
import { MEASUREMENT_PRESET_LABELS, toMeasurementPreset, fromMeasurementPreset, type MeasurementPreset, type MeasurementUnit } from "@/lib/level-measurement"

export type BenefitType = "PERCENTAGE" | "FIXED" | "BOTH"
export type { MeasurementUnit }

export type InternalLevelRule = {
  id: string
  name: string
  description: string | null
  order: number
  pointsRequired: number
  salaryIncreasePercent: string | null
  imageUrl: string | null
  medalIcon: MedalIconKey
  bonusDescription: string | null
  bonusAmount: string | null
  badgeColorHex: string
  benefitType: BenefitType
  measurementUnit: MeasurementUnit
  measurementValue: number | null
}

export type InternalLevelRuleInput = {
  name: string
  description?: string
  pointsRequired: number
  benefitType: BenefitType
  salaryIncreasePercent?: number
  bonusAmount?: number
  bonusDescription?: string
  measurementUnit: MeasurementUnit
  measurementValue?: number
  badgeColorHex: string
  medalIcon: MedalIconKey
  imageUrl?: string | null
}

const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  PERCENTAGE: "% de aumento salarial",
  FIXED: "Bônus fixo (R$)",
  BOTH: "% + Bônus fixo",
}

/** Trilha de Cargos do Programa Interno — usada em /company/programa-interno e na aba "Programa Interno" do Admin. */
export function InternalLevelRuleManager({
  levels,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  uploadEndpoint,
}: {
  levels: InternalLevelRule[]
  isLoading: boolean
  onCreate: (input: InternalLevelRuleInput) => Promise<void>
  onUpdate?: (level: InternalLevelRule, input: InternalLevelRuleInput) => Promise<void>
  onDelete: (level: InternalLevelRule) => Promise<void>
  uploadEndpoint: string
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<InternalLevelRule | null>(null)

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Cargo
        </Button>
      </div>
      {levels.length === 0 ? (
        <EmptyState message="Nenhum cargo cadastrado ainda. Crie a régua ex: Trainee -> Especialista -> Supervisor." />
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
                  {l.pointsRequired} pts para promover
                  {l.salaryIncreasePercent && ` · +${l.salaryIncreasePercent}% salário`}
                  {l.bonusAmount && ` · +R$${l.bonusAmount}`}
                  {l.bonusDescription && ` · ${l.bonusDescription}`}
                  {l.measurementUnit !== "ALL_TIME" && ` · ${MEASUREMENT_PRESET_LABELS[toMeasurementPreset(l.measurementUnit, l.measurementValue)]}`}
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
  level?: InternalLevelRule
  onClose: () => void
  onSave: (input: InternalLevelRuleInput) => Promise<void>
  uploadEndpoint: string
}) {
  const [name, setName] = useState(level?.name ?? "")
  const [description, setDescription] = useState(level?.description ?? "")
  const [pointsRequired, setPointsRequired] = useState(level ? String(level.pointsRequired) : "100")
  const [benefitType, setBenefitType] = useState<BenefitType>(level?.benefitType ?? "PERCENTAGE")
  const [salaryIncreasePercent, setSalaryIncreasePercent] = useState(level?.salaryIncreasePercent ?? "")
  const [bonusAmount, setBonusAmount] = useState(level?.bonusAmount ?? "")
  const [bonusDescription, setBonusDescription] = useState(level?.bonusDescription ?? "")
  const [measurementPreset, setMeasurementPreset] = useState<MeasurementPreset>(
    level ? toMeasurementPreset(level.measurementUnit, level.measurementValue) : "ALL_TIME",
  )
  const [badgeColorHex, setBadgeColorHex] = useState(level?.badgeColorHex ?? "#F58220")
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
        description: description || undefined,
        pointsRequired: Number(pointsRequired),
        benefitType,
        salaryIncreasePercent: benefitType !== "FIXED" ? Number(salaryIncreasePercent) : undefined,
        bonusAmount: benefitType !== "PERCENTAGE" ? Number(bonusAmount) : undefined,
        bonusDescription: bonusDescription || undefined,
        measurementUnit: unit,
        measurementValue: value || undefined,
        badgeColorHex,
        medalIcon,
        imageUrl,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar cargo")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{level ? "Editar Cargo do Plano de Carreira" : "Novo Cargo do Plano de Carreira"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome do cargo (livre — ex: "Especialista Jeri")</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Pontos exigidos para promover ao próximo</Label>
            <Input type="number" value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} required />
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Cor do nível (tema/badge do dashboard ao atingir este cargo)</Label>
            <Input type="color" value={badgeColorHex} onChange={(e) => setBadgeColorHex(e.target.value)} className="h-10 w-20" />
          </div>

          <MedalPicker
            medalIcon={medalIcon}
            imageUrl={imageUrl}
            badgeColorHex={badgeColorHex}
            onChange={setMedalIcon}
            onImageUploaded={setImageUrl}
            uploadEndpoint={uploadEndpoint}
            uploadKind="internal-level-image"
          />

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Período de mensuração do cargo</Label>
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
            <p className="text-xs text-gray-400">
              Se o colaborador não sustentar a pontuação exigida nesse prazo, o cargo é reavaliado/rebaixado.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Benefício da promoção</Label>
            <Select value={benefitType} onValueChange={(v) => setBenefitType(v as BenefitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BENEFIT_TYPE_LABELS) as BenefitType[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BENEFIT_TYPE_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {benefitType !== "FIXED" && (
              <div className="space-y-2">
                <Label>% de aumento salarial</Label>
                <Input type="number" step="0.1" value={salaryIncreasePercent} onChange={(e) => setSalaryIncreasePercent(e.target.value)} required />
              </div>
            )}
            {benefitType !== "PERCENTAGE" && (
              <div className="space-y-2">
                <Label>Bônus fixo (R$)</Label>
                <Input type="number" step="0.01" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} required />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Bônus associado (descrição livre)</Label>
            <Input value={bonusDescription} onChange={(e) => setBonusDescription(e.target.value)} placeholder="Ex: Vale-combustível" />
          </div>
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
