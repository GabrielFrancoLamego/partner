"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { EmptyState, LoadingState } from "@/components/admin/admin-ui"
import { FileUploadField } from "@/components/shared/file-upload-field"

export type BenefitType = "PERCENTAGE" | "FIXED" | "BOTH"
export type MeasurementUnit = "ALL_TIME" | "DAYS" | "MONTHS"

export type InternalLevelRule = {
  id: string
  name: string
  description: string | null
  order: number
  pointsRequired: number
  salaryIncreasePercent: string | null
  imageUrl: string | null
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
  imageUrl?: string
}

/** Atalhos do período de mensuração pedidos no produto: 30 dias, 6 meses, 1 ano (além de vitalício/customizado). */
const MEASUREMENT_PRESETS: { label: string; unit: MeasurementUnit; value?: number }[] = [
  { label: "Vitalício", unit: "ALL_TIME" },
  { label: "30 dias", unit: "DAYS", value: 30 },
  { label: "6 meses", unit: "MONTHS", value: 6 },
  { label: "1 ano", unit: "MONTHS", value: 12 },
]

const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = {
  ALL_TIME: "Vitalício (nunca reavalia)",
  DAYS: "Dias",
  MONTHS: "Meses",
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
  onDelete,
  uploadEndpoint,
}: {
  levels: InternalLevelRule[]
  isLoading: boolean
  onCreate: (input: InternalLevelRuleInput) => Promise<void>
  onDelete: (level: InternalLevelRule) => Promise<void>
  uploadEndpoint: string
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)

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
              {l.imageUrl ? (
                <img src={l.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-lg flex-shrink-0" style={{ backgroundColor: l.badgeColorHex }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#3E2415] text-sm">{l.name}</p>
                <p className="text-xs text-gray-500">
                  {l.pointsRequired} pts para promover
                  {l.salaryIncreasePercent && ` · +${l.salaryIncreasePercent}% salário`}
                  {l.bonusAmount && ` · +R$${l.bonusAmount}`}
                  {l.bonusDescription && ` · ${l.bonusDescription}`}
                  {l.measurementUnit !== "ALL_TIME" && l.measurementValue && ` · reavaliado a cada ${l.measurementValue} ${l.measurementUnit === "DAYS" ? "dias" : "meses"}`}
                </p>
              </div>
              <button onClick={() => onDelete(l)} className="text-red-400 hover:text-red-700 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {isCreateOpen && (
        <LevelDialog
          onClose={() => setIsCreateOpen(false)}
          onCreate={onCreate}
          uploadEndpoint={uploadEndpoint}
        />
      )}
    </div>
  )
}

function LevelDialog({
  onClose,
  onCreate,
  uploadEndpoint,
}: {
  onClose: () => void
  onCreate: (input: InternalLevelRuleInput) => Promise<void>
  uploadEndpoint: string
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pointsRequired, setPointsRequired] = useState("100")
  const [benefitType, setBenefitType] = useState<BenefitType>("PERCENTAGE")
  const [salaryIncreasePercent, setSalaryIncreasePercent] = useState("")
  const [bonusAmount, setBonusAmount] = useState("")
  const [bonusDescription, setBonusDescription] = useState("")
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("ALL_TIME")
  const [measurementValue, setMeasurementValue] = useState("")
  const [badgeColorHex, setBadgeColorHex] = useState("#F58220")
  const [imageUrl, setImageUrl] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (measurementUnit !== "ALL_TIME" && !measurementValue) {
      setError("Informe o valor do período de mensuração")
      return
    }
    setIsSubmitting(true)
    try {
      await onCreate({
        name,
        description: description || undefined,
        pointsRequired: Number(pointsRequired),
        benefitType,
        salaryIncreasePercent: benefitType !== "FIXED" ? Number(salaryIncreasePercent) : undefined,
        bonusAmount: benefitType !== "PERCENTAGE" ? Number(bonusAmount) : undefined,
        bonusDescription: bonusDescription || undefined,
        measurementUnit,
        measurementValue: measurementUnit !== "ALL_TIME" ? Number(measurementValue) : undefined,
        badgeColorHex,
        imageUrl: imageUrl || undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar cargo")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cargo do Plano de Carreira</DialogTitle>
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

          <FileUploadField
            label="Imagem da promoção (selo/medalha)"
            hint="Exibida na trilha de carreira do colaborador ao atingir este cargo"
            accept="image/png,image/jpeg,image/webp"
            currentUrl={imageUrl || null}
            uploadEndpoint={uploadEndpoint}
            kind="internal-level-image"
            onUploaded={setImageUrl}
            variant="image"
          />

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>Período de mensuração do cargo</Label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {MEASUREMENT_PRESETS.map((preset) => {
                const isActive = measurementUnit === preset.unit && (preset.unit === "ALL_TIME" || Number(measurementValue) === preset.value)
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setMeasurementUnit(preset.unit)
                      setMeasurementValue(preset.value ? String(preset.value) : "")
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#F58220] border-[#F58220] text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-[#F58220]"
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={measurementUnit} onValueChange={(v) => setMeasurementUnit(v as MeasurementUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEASUREMENT_UNIT_LABELS) as MeasurementUnit[]).map((u) => (
                    <SelectItem key={u} value={u}>
                      {MEASUREMENT_UNIT_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {measurementUnit !== "ALL_TIME" && (
                <Input
                  type="number"
                  value={measurementValue}
                  onChange={(e) => setMeasurementValue(e.target.value)}
                  placeholder={measurementUnit === "DAYS" ? "ex: 180" : "ex: 6"}
                  required
                />
              )}
            </div>
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
