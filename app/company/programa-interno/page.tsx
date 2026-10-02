"use client"

import { useEffect, useState } from "react"
import { Save, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { FileUploadField } from "@/components/shared/file-upload-field"
import {
  InternalLevelRuleManager,
  type InternalLevelRule,
  type InternalLevelRuleInput,
} from "@/components/shared/internal-level-rule-manager"
import { ServiceFeeTiersManager, type ServiceFeeTier, type ServiceFeeTierInput } from "@/components/shared/service-fee-tiers-manager"
import { ProgramTypeBadge } from "@/components/shared/program-type-badge"

type InternalProgram = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  pdfUrl: string | null
  videoUrl: string | null
  termsContent: string | null
  measurementPeriod: "MONTHLY" | "BIMONTHLY" | "SEMIANNUAL" | "ANNUAL"
  basePoints: number
  pointsPunctualEntry: number
  pointsChecklistOnTime: number
  pointsChecklistLate: number
  pointsChecklistFail: number
  pointsAbsenceJustified: number
  pointsAbsenceUnjustified: number
  pointsOccurrence: number
  lateToleranceMinutes: number
  pointsLatePenalty: number
  minEfficiencyPercent: number
  efficiencyBonusAmount: string | null
  levels: InternalLevelRule[]
}
type Employee = { id: string; name: string; xpPoints: number; currentLevel: { id: string; name: string } | null }

export default function CompanyProgramaInternoPage() {
  const user = useCompanyUser()
  const allowed = canManageDailyOperations(user.role)

  if (!allowed) return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2">
          <ProgramTypeBadge type="INTERNAL" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa Interno de Colaboradores</h1>
        <p className="text-gray-600 mt-1 text-sm">Regras de pontuação, plano de carreira e termo de aceite — 1 programa por empresa</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="config" className="flex-shrink-0">Configuração</TabsTrigger>
          <TabsTrigger value="fees" className="flex-shrink-0">Taxa de Serviço</TabsTrigger>
          <TabsTrigger value="levels" className="flex-shrink-0">Plano de Carreira</TabsTrigger>
          <TabsTrigger value="promote" className="flex-shrink-0">Promover Colaborador</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
          <TabsContent value="fees">
            <ServiceFeeTiersSection />
          </TabsContent>
          <TabsContent value="levels">
            <LevelsSection />
          </TabsContent>
          <TabsContent value="promote">
            <PromoteTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function ConfigTab() {
  const [program, setProgram] = useState<InternalProgram | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [termsContent, setTermsContent] = useState("")
  const [measurementPeriod, setMeasurementPeriod] = useState("MONTHLY")
  const [basePoints, setBasePoints] = useState("100")
  const [pointsPunctualEntry, setPointsPunctualEntry] = useState("5")
  const [pointsChecklistOnTime, setPointsChecklistOnTime] = useState("5")
  const [pointsChecklistLate, setPointsChecklistLate] = useState("-3")
  const [pointsChecklistFail, setPointsChecklistFail] = useState("-5")
  const [pointsAbsenceJustified, setPointsAbsenceJustified] = useState("0")
  const [pointsAbsenceUnjustified, setPointsAbsenceUnjustified] = useState("-15")
  const [pointsOccurrence, setPointsOccurrence] = useState("-10")
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState("15")
  const [pointsLatePenalty, setPointsLatePenalty] = useState("-5")
  const [minEfficiencyPercent, setMinEfficiencyPercent] = useState("90")
  const [efficiencyBonusAmount, setEfficiencyBonusAmount] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")

  useEffect(() => {
    adminFetch<InternalProgram | null>("/api/company/internal-program")
      .then((p) => {
        if (p) {
          setProgram(p)
          setTitle(p.title)
          setDescription(p.description ?? "")
          setTermsContent(p.termsContent ?? "")
          setMeasurementPeriod(p.measurementPeriod)
          setBasePoints(String(p.basePoints))
          setPointsPunctualEntry(String(p.pointsPunctualEntry))
          setPointsChecklistOnTime(String(p.pointsChecklistOnTime))
          setPointsChecklistLate(String(p.pointsChecklistLate))
          setPointsChecklistFail(String(p.pointsChecklistFail))
          setPointsAbsenceJustified(String(p.pointsAbsenceJustified))
          setPointsAbsenceUnjustified(String(p.pointsAbsenceUnjustified))
          setPointsOccurrence(String(p.pointsOccurrence))
          setLateToleranceMinutes(String(p.lateToleranceMinutes))
          setPointsLatePenalty(String(p.pointsLatePenalty))
          setMinEfficiencyPercent(String(p.minEfficiencyPercent))
          setEfficiencyBonusAmount(p.efficiencyBonusAmount ?? "")
          setVideoUrl(p.videoUrl ?? "")
          setImageUrl(p.imageUrl ?? "")
          setPdfUrl(p.pdfUrl ?? "")
        } else {
          setTitle("Programa Interno de Colaboradores")
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("title", title)
      body.append("description", description)
      body.append("termsContent", termsContent)
      body.append("measurementPeriod", measurementPeriod)
      body.append("basePoints", basePoints)
      body.append("pointsPunctualEntry", pointsPunctualEntry)
      body.append("pointsChecklistOnTime", pointsChecklistOnTime)
      body.append("pointsChecklistLate", pointsChecklistLate)
      body.append("pointsChecklistFail", pointsChecklistFail)
      body.append("pointsAbsenceJustified", pointsAbsenceJustified)
      body.append("pointsAbsenceUnjustified", pointsAbsenceUnjustified)
      body.append("pointsOccurrence", pointsOccurrence)
      body.append("lateToleranceMinutes", lateToleranceMinutes)
      body.append("pointsLatePenalty", pointsLatePenalty)
      body.append("minEfficiencyPercent", minEfficiencyPercent)
      if (efficiencyBonusAmount) body.append("efficiencyBonusAmount", efficiencyBonusAmount)
      body.append("videoUrl", videoUrl)
      if (imageUrl) body.append("imageUrl", imageUrl)
      if (pdfUrl) body.append("pdfUrl", pdfUrl)

      const saved = await adminFetch<InternalProgram>("/api/company/internal-program", { method: "PATCH", body })
      setProgram(saved)
      setSuccess("Programa Interno salvo com sucesso.")
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <AdminCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <div className="space-y-2">
          <Label>Título do Programa</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <RichTextEditor value={description} onChange={setDescription} placeholder="Descreva o Programa Interno..." />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Foto de capa"
            hint="Tamanho recomendado: 1200x630px · Máx: 5MB"
            accept="image/*"
            currentUrl={imageUrl || null}
            uploadEndpoint="/api/company/uploads"
            kind="internal-program-cover"
            onUploaded={setImageUrl}
            variant="image"
          />
          <FileUploadField
            label="Regulamento em PDF"
            accept="application/pdf"
            currentUrl={pdfUrl || null}
            uploadEndpoint="/api/company/uploads"
            kind="internal-program-pdf"
            onUploaded={setPdfUrl}
            variant="pdf"
          />
        </div>

        <div className="space-y-2 max-w-sm">
          <Label>Vídeo institucional (YouTube/Vimeo)</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
        </div>

        <div className="space-y-2">
          <Label>Termo de aceite (exibido em modal bloqueante no 1º acesso do colaborador)</Label>
          <Textarea value={termsContent} onChange={(e) => setTermsContent(e.target.value)} rows={6} placeholder="Escreva o termo/regulamento — aceita markdown simples." />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div className="space-y-2">
            <Label>Pontuação Base Mensal</Label>
            <Input type="number" value={basePoints} onChange={(e) => setBasePoints(e.target.value)} required />
            <p className="text-xs text-gray-400">Todo colaborador começa o dia 1º do mês com esta pontuação cheia.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Período de medição da avaliação</Label>
          <Select value={measurementPeriod} onValueChange={setMeasurementPeriod}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Mensal</SelectItem>
              <SelectItem value="BIMONTHLY">Bimestral</SelectItem>
              <SelectItem value="SEMIANNUAL">Semestral</SelectItem>
              <SelectItem value="ANNUAL">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h4 className="font-semibold text-[#3E2415] text-sm mb-3">Regras Padrão de Pontuação Automática</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Entrada pontual no GPS</Label>
              <Input type="number" value={pointsPunctualEntry} onChange={(e) => setPointsPunctualEntry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Checklist cumprido no prazo</Label>
              <Input type="number" value={pointsChecklistOnTime} onChange={(e) => setPointsChecklistOnTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Checklist atrasado</Label>
              <Input type="number" value={pointsChecklistLate} onChange={(e) => setPointsChecklistLate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Checklist incompleto/reprovado</Label>
              <Input type="number" value={pointsChecklistFail} onChange={(e) => setPointsChecklistFail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Falta com atestado</Label>
              <Input type="number" value={pointsAbsenceJustified} onChange={(e) => setPointsAbsenceJustified(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Falta sem atestado</Label>
              <Input type="number" value={pointsAbsenceUnjustified} onChange={(e) => setPointsAbsenceUnjustified(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advertência/ocorrência</Label>
              <Input type="number" value={pointsOccurrence} onChange={(e) => setPointsOccurrence(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h4 className="font-semibold text-[#3E2415] text-sm mb-3">Tolerância do Ponto Digital</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tolerância antes/depois do horário (minutos)</Label>
              <Input type="number" min="0" value={lateToleranceMinutes} onChange={(e) => setLateToleranceMinutes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pts descontados por atraso além da tolerância</Label>
              <Input type="number" value={pointsLatePenalty} onChange={(e) => setPointsLatePenalty(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Dentro da margem de tolerância, a batida não gera hora extra nem penalidade. Além dela, desconta Pts automaticamente e o excedente entra no Banco de Horas.
          </p>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h4 className="font-semibold text-[#3E2415] text-sm mb-3">Bônus de Eficiência</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>% mínima de checklist no prazo</Label>
              <Input type="number" value={minEfficiencyPercent} onChange={(e) => setMinEfficiencyPercent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor do bônus (R$)</Label>
              <Input type="number" step="0.01" value={efficiencyBonusAmount} onChange={(e) => setEfficiencyBonusAmount(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        </div>

        <Button type="submit" variant="brand" disabled={isSubmitting}>
          <Save className="h-4 w-4 mr-1" /> Salvar Programa Interno
        </Button>
      </form>
    </AdminCard>
  )
}

function ServiceFeeTiersSection() {
  const [tiers, setTiers] = useState<ServiceFeeTier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ServiceFeeTier[]>("/api/company/internal-program/service-fee-tiers").then(setTiers).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleCreate = async (input: ServiceFeeTierInput) => {
    await adminFetch("/api/company/internal-program/service-fee-tiers", { method: "POST", body: JSON.stringify(input) })
    reload()
  }

  const handleDelete = async (tier: ServiceFeeTier) => {
    await adminFetch(`/api/company/internal-program/service-fee-tiers/${tier.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao remover"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />
  return <ServiceFeeTiersManager tiers={tiers} onCreate={handleCreate} onDelete={handleDelete} />
}

function LevelsSection() {
  const [levels, setLevels] = useState<InternalLevelRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<InternalLevelRule[]>("/api/company/gamification/levels").then(setLevels).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleCreate = async (input: InternalLevelRuleInput) => {
    await adminFetch("/api/company/gamification/levels", { method: "POST", body: JSON.stringify(input) })
    reload()
  }

  const handleUpdate = async (level: InternalLevelRule, input: InternalLevelRuleInput) => {
    await adminFetch(`/api/company/gamification/levels/${level.id}`, { method: "PATCH", body: JSON.stringify(input) })
    reload()
  }

  const handleDelete = async (level: InternalLevelRule) => {
    if (!confirm(`Excluir o cargo "${level.name}"?`)) return
    await adminFetch(`/api/company/gamification/levels/${level.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <InternalLevelRuleManager
      levels={levels}
      isLoading={isLoading}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      uploadEndpoint="/api/company/uploads"
    />
  )
}

function PromoteTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [levels, setLevels] = useState<InternalLevelRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [targetLevelId, setTargetLevelId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const reload = () => {
    setIsLoading(true)
    Promise.all([adminFetch<Employee[]>("/api/company/employees"), adminFetch<InternalLevelRule[]>("/api/company/gamification/levels")])
      .then(([e, l]) => {
        setEmployees(e)
        setLevels(l)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handlePromote = async () => {
    if (!selectedEmployee || !targetLevelId) return
    if (!confirm(`Promover ${selectedEmployee.name}? A pontuação de Pts dele será zerada, iniciando um novo ciclo no novo cargo.`)) return
    setIsSubmitting(true)
    setMessage("")
    try {
      await adminFetch(`/api/company/employees/${selectedEmployee.id}/promote`, { method: "POST", body: JSON.stringify({ levelId: targetLevelId }) })
      setMessage(`${selectedEmployee.name} promovido(a) com sucesso — Pts zerado no novo cargo.`)
      setSelectedEmployee(null)
      setTargetLevelId("")
      reload()
    } catch (e) {
      setMessage(e instanceof AdminApiError ? e.message : "Erro ao promover")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (levels.length === 0) return <EmptyState message="Cadastre pelo menos um cargo na aba Plano de Carreira antes de promover alguém." />

  return (
    <AdminCard title="Mudança de Cargo" icon={ArrowUpCircle}>
      <p className="text-xs text-gray-500 mb-4">Ao mudar o cargo do colaborador, a pontuação acumulada é zerada — ele começa um novo ciclo no cargo novo.</p>
      {message && <p className="text-sm text-green-600 mb-3">{message}</p>}
      <div className="space-y-2">
        {employees.map((e) => (
          <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-gray-100">
            <div>
              <p className="font-medium text-[#3E2415] text-sm">{e.name}</p>
              <p className="text-xs text-gray-500">
                Cargo atual: {e.currentLevel?.name ?? "Sem cargo"} · {e.xpPoints} pts
              </p>
            </div>
            {selectedEmployee?.id === e.id ? (
              <div className="flex items-center gap-2">
                <Select value={targetLevelId} onValueChange={setTargetLevelId}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Novo cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!targetLevelId || isSubmitting} onClick={handlePromote} variant="brand">
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedEmployee(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setSelectedEmployee(e)}>
                Mudar cargo
              </Button>
            )}
          </div>
        ))}
      </div>
    </AdminCard>
  )
}
