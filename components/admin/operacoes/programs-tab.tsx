"use client"

import { useEffect, useState } from "react"
import { Plus, Trophy, Pencil, PlayCircle, PauseCircle, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { IconActionButton } from "@/components/ui/icon-action-button"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { FileUploadField } from "@/components/shared/file-upload-field"
import { ProgramLevelsManager, type ProgramLevel, type ProgramLevelInput } from "@/components/shared/program-levels-manager"
import { ProgramTypeBadge } from "@/components/shared/program-type-badge"

type CommissionFormat = "PERCENTAGE" | "FIXED_VALUE" | "PRODUCT_UNIT"

export type Program = {
  id: string
  name: string
  description: string
  commissionType: "FIXED" | "VARIABLE" | "BOTH"
  commissionValue: string
  commissionFormat: CommissionFormat
  fixedValue: string | null
  productUnitLabel: string | null
  imageUrl: string | null
  pdfUrl: string | null
  videoUrl: string | null
  termsContent: string | null
  active: boolean
  status: "ACTIVE" | "PAUSED_FOR_NEW_MEMBERS" | "ARCHIVED"
  pauseEffectiveAt: string | null
  company: { id: string; name: string; city?: string | null }
  _count: { referrals: number }
}

const FORMAT_LABELS: Record<CommissionFormat, string> = {
  PERCENTAGE: "Percentual (%)",
  FIXED_VALUE: "Valor fixo (R$)",
  PRODUCT_UNIT: "Unidade de produto",
}

/** Exibe o valor de comissão com o sufixo correto conforme o formato configurado. */
function formatCommissionValue(program: Pick<Program, "commissionFormat" | "commissionValue" | "productUnitLabel" | "commissionType" | "fixedValue">) {
  const base = (() => {
    switch (program.commissionFormat) {
      case "PERCENTAGE":
        return `${program.commissionValue}%`
      case "FIXED_VALUE":
        return `R$ ${program.commissionValue}`
      case "PRODUCT_UNIT":
        return `${program.commissionValue}x ${program.productUnitLabel ?? "unidade"}`
    }
  })()
  return program.commissionType === "BOTH" && program.fixedValue ? `${base} + R$ ${program.fixedValue}` : base
}

export function ProgramsTab() {
  const { companies } = useCompanies()
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Program | "new" | null>(null)
  const [managingLevels, setManagingLevels] = useState<Program | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Program[]>("/api/admin/programs")
      .then(setPrograms)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} variant="brand">
          <Plus className="h-4 w-4 mr-2" />
          Novo Programa
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : programs.length === 0 ? (
        <EmptyState message="Nenhum programa de parceria cadastrado ainda." />
      ) : (
        <div className="grid gap-3">
          {programs.map((program) => (
            <div key={program.id} className="p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <ProgramTypeBadge type="PARTNER" />
                    <StatusBadge status={program.status} />
                  </div>
                  <p className="font-semibold text-[#3E2415]">{program.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{program.company.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Comissão: {formatCommissionValue(program)} (
                    {program.commissionType === "FIXED" ? "fixa" : program.commissionType === "VARIABLE" ? "variável" : "ambas"}) ·{" "}
                    {program._count.referrals} indicações
                  </p>
                  {program.status === "PAUSED_FOR_NEW_MEMBERS" && program.pauseEffectiveAt && (
                    <p className="text-xs text-amber-700 mt-1">
                      Arquivamento automático em {new Date(program.pauseEffectiveAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <ProgramActions program={program} onManageLevels={() => setManagingLevels(program)} onEdit={() => setEditing(program)} onChanged={reload} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProgramDialog
          program={editing === "new" ? null : editing}
          companies={companies}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      {managingLevels && <LevelsManagerDialog program={managingLevels} onClose={() => setManagingLevels(null)} />}
    </div>
  )
}

/**
 * Ações inline (sem redirecionar de tela) reaproveitadas por ProgramsTab e
 * OverviewTab — task: "remova o botão redirecionador genérico 'Gerenciar'".
 * Arquivar chama PATCH status=ARCHIVED (nunca DELETE — Program.id pode ser
 * referenciado por Referral/PartnerTermAcceptance/ProgramMembership).
 */
export function ProgramActions({
  program,
  onManageLevels,
  onEdit,
  onChanged,
}: {
  program: Program
  onManageLevels: () => void
  onEdit: () => void
  onChanged: () => void
}) {
  const handleSetStatus = async (status: "ACTIVE" | "PAUSED_FOR_NEW_MEMBERS" | "ARCHIVED") => {
    if (status === "PAUSED_FOR_NEW_MEMBERS") {
      if (!confirm(`Pausar "${program.name}" para novas adesões? Parceiros já vinculados mantêm acesso total por 30 dias — eles serão avisados agora.`)) return
    }
    if (status === "ARCHIVED") {
      if (!confirm(`Arquivar "${program.name}"? Todos os vínculos ativos serão encerrados imediatamente (o saldo já aprovado continua sacável).`)) return
    }
    await adminFetch(`/api/admin/programs/${program.id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    onChanged()
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <IconActionButton icon={Trophy} label="Níveis de Crescimento" onClick={onManageLevels} />
      <IconActionButton icon={Pencil} label="Editar" onClick={onEdit} />
      {program.status === "ACTIVE" && (
        <IconActionButton icon={PauseCircle} label="Pausar p/ novas adesões" onClick={() => handleSetStatus("PAUSED_FOR_NEW_MEMBERS")} />
      )}
      {program.status === "PAUSED_FOR_NEW_MEMBERS" && (
        <IconActionButton icon={PlayCircle} label="Retomar adesões" onClick={() => handleSetStatus("ACTIVE")} />
      )}
      {program.status !== "ARCHIVED" && (
        <IconActionButton icon={Archive} label="Arquivar" onClick={() => handleSetStatus("ARCHIVED")} className="text-red-600 hover:text-red-700" />
      )}
    </div>
  )
}

export function LevelsManagerDialog({ program, onClose }: { program: Program; onClose: () => void }) {
  const [levels, setLevels] = useState<ProgramLevel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ProgramLevel[]>(`/api/admin/programs/${program.id}/levels`).then(setLevels).finally(() => setIsLoading(false))
  }
  useEffect(reload, [program.id])

  const handleCreate = async (input: ProgramLevelInput) => {
    await adminFetch(`/api/admin/programs/${program.id}/levels`, { method: "POST", body: JSON.stringify(input) })
    reload()
  }

  const handleUpdate = async (level: ProgramLevel, input: ProgramLevelInput) => {
    await adminFetch(`/api/admin/programs/${program.id}/levels/${level.id}`, { method: "PATCH", body: JSON.stringify(input) })
    reload()
  }

  const handleDelete = async (level: ProgramLevel) => {
    if (!confirm(`Excluir o nível "${level.name}"?`)) return
    await adminFetch(`/api/admin/programs/${program.id}/levels/${level.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Níveis de Crescimento — {program.name}</DialogTitle>
        </DialogHeader>
        <ProgramLevelsManager
          levels={levels}
          isLoading={isLoading}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          uploadEndpoint="/api/admin/uploads"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProgramDialog({
  program,
  companies,
  onClose,
  onSaved,
}: {
  program: Program | null
  companies: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [companyId, setCompanyId] = useState(program?.company.id ?? companies[0]?.id ?? "")
  const [name, setName] = useState(program?.name ?? "")
  const [description, setDescription] = useState(program?.description ?? "")
  const [commissionFormat, setCommissionFormat] = useState<CommissionFormat>(program?.commissionFormat ?? "PERCENTAGE")
  const [commissionValue, setCommissionValue] = useState(program?.commissionValue ?? "")
  const [hasFixedExtra, setHasFixedExtra] = useState(program?.commissionType === "BOTH")
  const [fixedValue, setFixedValue] = useState(program?.fixedValue ?? "")
  const [productUnitLabel, setProductUnitLabel] = useState(program?.productUnitLabel ?? "")
  const [imageUrl, setImageUrl] = useState(program?.imageUrl ?? "")
  const [pdfUrl, setPdfUrl] = useState(program?.pdfUrl ?? "")
  const [videoUrl, setVideoUrl] = useState(program?.videoUrl ?? "")
  const [termsContent, setTermsContent] = useState(program?.termsContent ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const valueSuffix = commissionFormat === "PERCENTAGE" ? "%" : commissionFormat === "FIXED_VALUE" ? "R$" : "un."

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (commissionFormat === "PRODUCT_UNIT" && !productUnitLabel.trim()) {
      setError("Informe o rótulo da unidade de produto (ex: 'diária grátis')")
      return
    }
    if (commissionFormat === "PERCENTAGE" && hasFixedExtra && !fixedValue) {
      setError("Informe o valor fixo adicional por indicação")
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        name,
        description,
        commissionValue: Number(commissionValue),
        commissionFormat,
        fixedValue: commissionFormat === "PERCENTAGE" && hasFixedExtra ? Number(fixedValue) : null,
        productUnitLabel: commissionFormat === "PRODUCT_UNIT" ? productUnitLabel : null,
        imageUrl: imageUrl || null,
        pdfUrl: pdfUrl || null,
        videoUrl: videoUrl || null,
        termsContent: termsContent || null,
      }
      if (program) {
        await adminFetch(`/api/admin/programs/${program.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      } else {
        await adminFetch("/api/admin/programs", { method: "POST", body: JSON.stringify({ companyId, ...payload }) })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{program ? "Editar Programa" : "Novo Programa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!program && (
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Conte sobre o programa — use negrito, títulos e listas." />
          </div>

          <Tabs defaultValue="comissao">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="comissao">Comissão</TabsTrigger>
              <TabsTrigger value="midia">Mídias & Regulamento</TabsTrigger>
            </TabsList>

            <TabsContent value="comissao" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Formato da comissão</Label>
                <Select value={commissionFormat} onValueChange={(v) => setCommissionFormat(v as CommissionFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMAT_LABELS) as CommissionFormat[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {FORMAT_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">O tipo de comissão (fixa/variável/combinada) é definido automaticamente por este formato.</p>
              </div>
              <div className="space-y-2">
                <Label>Valor da comissão ({valueSuffix})</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    className="pr-12"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{valueSuffix}</span>
                </div>
              </div>
              {commissionFormat === "PRODUCT_UNIT" && (
                <div className="space-y-2">
                  <Label>Rótulo da unidade de produto</Label>
                  <Input
                    value={productUnitLabel}
                    onChange={(e) => setProductUnitLabel(e.target.value)}
                    placeholder="ex: diária grátis, brinde, cortesia"
                    required
                  />
                </div>
              )}
              {commissionFormat === "PERCENTAGE" && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 text-sm text-[#3E2415]">
                    <Checkbox checked={hasFixedExtra} onCheckedChange={(v) => setHasFixedExtra(v === true)} />
                    Comissão combinada — somar um valor fixo (R$) além da %
                  </label>
                  {hasFixedExtra && (
                    <>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                        <Input type="number" step="0.01" value={fixedValue} onChange={(e) => setFixedValue(e.target.value)} className="pl-9" required />
                      </div>
                      <p className="text-xs text-gray-400">
                        Ex: {commissionValue || "10"}% da venda + R${fixedValue || "5,00"} fixo por indicação.
                      </p>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="midia" className="space-y-4 pt-4">
              <FileUploadField
                label="Capa do programa"
                hint="Tamanho recomendado: 1200x630px · Máx: 5MB"
                accept="image/png,image/jpeg,image/webp"
                currentUrl={imageUrl || null}
                uploadEndpoint="/api/admin/uploads"
                kind="program-cover"
                onUploaded={setImageUrl}
                variant="image"
              />
              <FileUploadField
                label="Regulamento em PDF"
                accept="application/pdf"
                currentUrl={pdfUrl || null}
                uploadEndpoint="/api/admin/uploads"
                kind="program-pdf"
                onUploaded={setPdfUrl}
                variant="pdf"
              />
              <div className="space-y-2">
                <Label>Vídeo institucional (YouTube/Vimeo)</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Regulamento / Termo de aceite</Label>
                <RichTextEditor
                  value={termsContent}
                  onChange={setTermsContent}
                  placeholder="Texto exibido ao parceiro no primeiro acesso, que ele precisa aceitar..."
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
