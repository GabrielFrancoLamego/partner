"use client"

import { useEffect, useMemo, useState } from "react"
import { Save, ArrowLeft, Plus, Pencil, MapPin, Building2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { LoadingState, AdminCard, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
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
  minEfficiencyPercent: number
  efficiencyBonusAmount: string | null
} | null

type ListedProgram = {
  id: string
  title: string
  basePoints: number
  active: boolean
  company: { id: string; name: string; city: string | null }
  _count: { levels: number }
}

/**
 * Visão cross-tenant do Programa Interno — o Admin primeiro vê a LISTA de
 * programas já criados por empresa (com filtros de Cidade/Empresa/Status);
 * só entra no formulário completo ao clicar em "Editar" ou "Novo Programa"
 * de uma empresa específica. Reaproveita os mesmos componentes/campos que o
 * Master vê em /company/programa-interno.
 */
export function InternalProgramsTab({ initialCompanyId }: { initialCompanyId?: string | null } = {}) {
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null)

  useEffect(() => {
    if (initialCompanyId) setCompanyId(initialCompanyId)
  }, [initialCompanyId])

  if (companyId) {
    return <ProgramDetail companyId={companyId} onBack={() => setCompanyId(null)} />
  }

  return <ProgramList onSelect={setCompanyId} />
}

function ProgramList({ onSelect }: { onSelect: (companyId: string) => void }) {
  const { companies } = useCompanies()
  const [programs, setPrograms] = useState<ListedProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "INACTIVE" | "NOT_CREATED">("all")

  useEffect(() => {
    setIsLoading(true)
    adminFetch<ListedProgram[]>("/api/admin/internal-programs")
      .then(setPrograms)
      .finally(() => setIsLoading(false))
  }, [])

  const cities = useMemo(
    () => Array.from(new Set(companies.map((c) => c.city).filter((c): c is string => Boolean(c)))).sort(),
    [companies],
  )

  const programByCompanyId = useMemo(() => new Map(programs.map((p) => [p.company.id, p])), [programs])

  // Uma linha por empresa — inclusive as que ainda não criaram programa nenhum ("Novo Programa").
  const rows = useMemo(() => {
    return companies.map((c) => ({ company: c, program: programByCompanyId.get(c.id) ?? null }))
  }, [companies, programByCompanyId])

  const filteredRows = useMemo(() => {
    return rows.filter(({ company, program }) => {
      if (cityFilter && company.city !== cityFilter) return false
      if (companyFilter && company.id !== companyFilter) return false
      if (statusFilter === "NOT_CREATED" && program) return false
      if (statusFilter === "ACTIVE" && program?.active !== true) return false
      if (statusFilter === "INACTIVE" && !(program && !program.active)) return false
      return true
    })
  }, [rows, cityFilter, companyFilter, statusFilter])

  const hasFilter = Boolean(cityFilter) || Boolean(companyFilter) || statusFilter !== "all"
  const clearFilters = () => {
    setCityFilter(null)
    setCompanyFilter(null)
    setStatusFilter("all")
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <ProgramTypeBadge type="INTERNAL" />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={cityFilter ?? "all"} onValueChange={(v) => setCityFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-52 h-9 text-xs">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Cidades</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={companyFilter ?? "all"} onValueChange={(v) => setCompanyFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-52 h-9 text-xs">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Empresas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-52 h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="INACTIVE">Inativo</SelectItem>
            <SelectItem value="NOT_CREATED">Ainda não criado</SelectItem>
          </SelectContent>
        </Select>

        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-0.5 text-xs font-medium text-orange-800 underline underline-offset-2 cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState message={hasFilter ? "Nenhuma empresa nesses filtros." : "Nenhuma empresa cadastrada ainda."} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRows.map(({ company, program }) => (
            <div key={company.id} className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#3E2415] truncate">{company.name}</p>
                {program ? (
                  <StatusBadge status={program.active ? "ACTIVE" : "INACTIVE"} />
                ) : (
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
                    Não criado
                  </span>
                )}
              </div>
              {company.city && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {company.city}
                </p>
              )}
              {program ? (
                <p className="text-xs text-gray-600">
                  {program.basePoints} pts base/mês · {program._count.levels} cargo(s)
                </p>
              ) : (
                <p className="text-xs text-gray-400">Nenhum programa configurado ainda.</p>
              )}
              <Button
                size="sm"
                variant={program ? "outline" : "brand"}
                className="mt-1 self-start"
                onClick={() => onSelect(company.id)}
              >
                {program ? (
                  <>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Programa
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgramDetail({ companyId, onBack }: { companyId: string; onBack: () => void }) {
  const { companies } = useCompanies()
  const company = companies.find((c) => c.id === companyId)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-[#3E2415] hover:text-[#F58220] cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a lista
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <ProgramTypeBadge type="INTERNAL" />
        {company && (
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <Building2 className="h-3.5 w-3.5" /> {company.name}
            {company.city && ` · ${company.city}`}
          </span>
        )}
      </div>

      <Tabs defaultValue="config" key={companyId}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="fees">Taxa de Serviço</TabsTrigger>
          <TabsTrigger value="levels">Plano de Carreira</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="config">
            <ConfigSection companyId={companyId} />
          </TabsContent>
          <TabsContent value="fees">
            <ServiceFeeTiersSection companyId={companyId} />
          </TabsContent>
          <TabsContent value="levels">
            <LevelsSection companyId={companyId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function ConfigSection({ companyId }: { companyId: string }) {
  const [program, setProgram] = useState<InternalProgram>(null)
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
  const [minEfficiencyPercent, setMinEfficiencyPercent] = useState("90")
  const [efficiencyBonusAmount, setEfficiencyBonusAmount] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")

  useEffect(() => {
    setIsLoading(true)
    adminFetch<{ program: InternalProgram }>(`/api/admin/internal-programs/${companyId}`)
      .then(({ program: p }) => {
        setProgram(p)
        if (p) {
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
          setMinEfficiencyPercent(String(p.minEfficiencyPercent))
          setEfficiencyBonusAmount(p.efficiencyBonusAmount ?? "")
          setVideoUrl(p.videoUrl ?? "")
          setImageUrl(p.imageUrl ?? "")
          setPdfUrl(p.pdfUrl ?? "")
        } else {
          setTitle("Programa Interno de Colaboradores")
          setVideoUrl("")
          setImageUrl("")
          setPdfUrl("")
        }
      })
      .finally(() => setIsLoading(false))
  }, [companyId])

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
      body.append("minEfficiencyPercent", minEfficiencyPercent)
      if (efficiencyBonusAmount) body.append("efficiencyBonusAmount", efficiencyBonusAmount)
      body.append("videoUrl", videoUrl)
      if (imageUrl) body.append("imageUrl", imageUrl)
      if (pdfUrl) body.append("pdfUrl", pdfUrl)

      const { program: saved } = await adminFetch<{ program: InternalProgram }>(`/api/admin/internal-programs/${companyId}`, {
        method: "PATCH",
        body,
      })
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
            accept="image/png,image/jpeg,image/webp"
            currentUrl={imageUrl || null}
            uploadEndpoint="/api/admin/uploads"
            kind="internal-program-cover"
            onUploaded={setImageUrl}
            variant="image"
          />
          <FileUploadField
            label="Regulamento em PDF"
            accept="application/pdf"
            currentUrl={pdfUrl || null}
            uploadEndpoint="/api/admin/uploads"
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
          <RichTextEditor value={termsContent} onChange={setTermsContent} placeholder="Escreva o termo/regulamento..." />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div className="space-y-2">
            <Label>Pontuação Base Mensal</Label>
            <Input type="number" value={basePoints} onChange={(e) => setBasePoints(e.target.value)} required />
            <p className="text-xs text-gray-400">Todo colaborador começa o dia 1º do mês com esta pontuação cheia.</p>
          </div>
          <div className="space-y-2">
            <Label>Período de medição da avaliação</Label>
            <Select value={measurementPeriod} onValueChange={setMeasurementPeriod}>
              <SelectTrigger>
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

function ServiceFeeTiersSection({ companyId }: { companyId: string }) {
  const [tiers, setTiers] = useState<ServiceFeeTier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ServiceFeeTier[]>(`/api/admin/internal-programs/${companyId}/service-fee-tiers`).then(setTiers).finally(() => setIsLoading(false))
  }
  useEffect(reload, [companyId])

  const handleCreate = async (input: ServiceFeeTierInput) => {
    await adminFetch(`/api/admin/internal-programs/${companyId}/service-fee-tiers`, { method: "POST", body: JSON.stringify(input) })
    reload()
  }

  const handleDelete = async (tier: ServiceFeeTier) => {
    await adminFetch(`/api/admin/internal-programs/${companyId}/service-fee-tiers/${tier.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao remover"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />
  return <ServiceFeeTiersManager tiers={tiers} onCreate={handleCreate} onDelete={handleDelete} />
}

function LevelsSection({ companyId }: { companyId: string }) {
  const [levels, setLevels] = useState<InternalLevelRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<InternalLevelRule[]>(`/api/admin/internal-programs/${companyId}/levels`).then(setLevels).finally(() => setIsLoading(false))
  }
  useEffect(reload, [companyId])

  const handleCreate = async (input: InternalLevelRuleInput) => {
    await adminFetch(`/api/admin/internal-programs/${companyId}/levels`, { method: "POST", body: JSON.stringify(input) })
    reload()
  }

  const handleUpdate = async (level: InternalLevelRule, input: InternalLevelRuleInput) => {
    await adminFetch(`/api/admin/internal-programs/${companyId}/levels/${level.id}`, { method: "PATCH", body: JSON.stringify(input) })
    reload()
  }

  const handleDelete = async (level: InternalLevelRule) => {
    if (!confirm(`Excluir o cargo "${level.name}"?`)) return
    await adminFetch(`/api/admin/internal-programs/${companyId}/levels/${level.id}`, { method: "DELETE" }).catch((e) =>
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
      uploadEndpoint="/api/admin/uploads"
    />
  )
}
