"use client"

import { useEffect, useRef, useState } from "react"
import { PauseCircle, PlayCircle, Upload, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, StatusBadge } from "@/components/admin/admin-ui"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { ProgramLevelsManager, type ProgramLevel, type ProgramLevelInput } from "@/components/shared/program-levels-manager"
import { ProgramTypeBadge } from "@/components/shared/program-type-badge"

type CommissionFormat = "PERCENTAGE" | "FIXED_VALUE" | "PRODUCT_UNIT"

type Program = {
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
  validFrom: string | null
  validUntil: string | null
  active: boolean
  status: "ACTIVE" | "PAUSED_FOR_NEW_MEMBERS" | "ARCHIVED"
  pauseEffectiveAt: string | null
} | null

const FORMAT_LABELS: Record<CommissionFormat, string> = {
  PERCENTAGE: "Percentual (%)",
  FIXED_VALUE: "Valor fixo (R$)",
  PRODUCT_UNIT: "Unidade de produto",
}

export default function CompanyProgramsPage() {
  const [program, setProgram] = useState<Program>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [commissionFormat, setCommissionFormat] = useState<CommissionFormat>("PERCENTAGE")
  const [commissionValue, setCommissionValue] = useState("")
  const [hasFixedExtra, setHasFixedExtra] = useState(false)
  const [fixedValue, setFixedValue] = useState("")
  const [productUnitLabel, setProductUnitLabel] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [termsContent, setTermsContent] = useState("")
  const [indeterminate, setIndeterminate] = useState(true)
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setIsLoading(true)
    adminFetch<Program>("/api/company/program")
      .then((p) => {
        setProgram(p)
        if (p) {
          setName(p.name)
          setDescription(p.description)
          setCommissionFormat(p.commissionFormat)
          setCommissionValue(p.commissionValue)
          setHasFixedExtra(p.commissionType === "BOTH")
          setFixedValue(p.fixedValue ?? "")
          setProductUnitLabel(p.productUnitLabel ?? "")
          setImageUrl(p.imageUrl ?? "")
          setPdfUrl(p.pdfUrl ?? "")
          setVideoUrl(p.videoUrl ?? "")
          setTermsContent(p.termsContent ?? "")
          setIndeterminate(!p.validFrom && !p.validUntil)
          setValidFrom(p.validFrom?.slice(0, 10) ?? "")
          setValidUntil(p.validUntil?.slice(0, 10) ?? "")
        }
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(load, [])

  const handleUpload = async (file: File, kind: "program-cover" | "program-pdf") => {
    const setUploading = kind === "program-cover" ? setIsUploadingCover : setIsUploadingPdf
    setUploading(true)
    try {
      const body = new FormData()
      body.append("kind", kind)
      body.append("file", file)
      const { url } = await adminFetch<{ url: string }>("/api/company/uploads", { method: "POST", body })
      if (kind === "program-cover") setImageUrl(url)
      else setPdfUrl(url)
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao enviar arquivo")
    } finally {
      setUploading(false)
    }
  }

  // Empresa não pode cancelar o programa direto — só pausar para novas
  // adesões, com aviso automático aos parceiros já vinculados e 30 dias de
  // acesso garantido (ver lib/program-lifecycle.ts). O encerramento
  // definitivo acontece sozinho depois disso.
  const handleTogglePause = async () => {
    if (!program) return
    const nextStatus = program.status === "ACTIVE" ? "PAUSED_FOR_NEW_MEMBERS" : "ACTIVE"
    if (nextStatus === "PAUSED_FOR_NEW_MEMBERS" && !confirm("Pausar o programa para novas adesões? Os parceiros já vinculados serão avisados e mantêm acesso total por 30 dias.")) {
      return
    }
    await adminFetch("/api/company/program", { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    load()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    if (commissionFormat === "PRODUCT_UNIT" && !productUnitLabel.trim()) {
      setError("Informe o rótulo da unidade de produto")
      return
    }
    if (commissionFormat === "PERCENTAGE" && hasFixedExtra && !fixedValue) {
      setError("Informe o valor fixo adicional por indicação")
      return
    }
    setIsSaving(true)
    try {
      await adminFetch("/api/company/program", {
        method: "PUT",
        body: JSON.stringify({
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
          validFrom: !indeterminate && validFrom ? validFrom : null,
          validUntil: !indeterminate && validUntil ? validUntil : null,
        }),
      })
      setMessage("Programa salvo com sucesso!")
      load()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingState />

  const valueSuffix = commissionFormat === "PERCENTAGE" ? "%" : commissionFormat === "FIXED_VALUE" ? "R$" : "un."

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="mb-2">
            <ProgramTypeBadge type="PARTNER" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa de Parceria</h1>
          <p className="text-gray-600 mt-1 text-sm">Como sua empresa recompensa parceiros que indicam clientes.</p>
        </div>
        {program && program.status !== "ARCHIVED" && (
          <Button variant="outline" onClick={handleTogglePause} className="self-start sm:self-auto">
            {program.status === "ACTIVE" ? <PauseCircle className="h-4 w-4 mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            {program.status === "ACTIVE" ? "Pausar p/ novas adesões" : "Retomar adesões"}
            <span className="ml-2">
              <StatusBadge status={program.status} />
            </span>
          </Button>
        )}
      </div>

      {program?.status === "PAUSED_FOR_NEW_MEMBERS" && program.pauseEffectiveAt && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
          Programa fechado para novas adesões. Parceiros já vinculados mantêm acesso total (saques e QR Codes) até{" "}
          <strong>{new Date(program.pauseEffectiveAt).toLocaleDateString("pt-BR")}</strong>, quando o programa é encerrado automaticamente.
        </div>
      )}
      {program?.status === "ARCHIVED" && (
        <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600">
          Este programa foi arquivado pelo Admin da plataforma e não pode mais ser editado por aqui.
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 space-y-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}

        <div className="space-y-2">
          <Label>Nome do programa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <RichTextEditor value={description} onChange={setDescription} placeholder="Conte sobre o programa — use negrito, títulos e listas." />
        </div>

        <Tabs defaultValue="comissao">
          <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger value="comissao" className="flex-shrink-0">Comissão</TabsTrigger>
            <TabsTrigger value="midia" className="flex-shrink-0">Mídias</TabsTrigger>
            <TabsTrigger value="validade" className="flex-shrink-0">Validade & Regulamento</TabsTrigger>
          </TabsList>

          <TabsContent value="comissao" className="space-y-4 pt-4">
            <div className="space-y-2 max-w-xs">
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
              <div className="relative max-w-xs">
                {commissionFormat === "FIXED_VALUE" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                )}
                <Input
                  type="number"
                  step="0.01"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  className={commissionFormat === "FIXED_VALUE" ? "pl-9 pr-3" : "pr-10"}
                  required
                />
                {commissionFormat !== "FIXED_VALUE" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{valueSuffix}</span>
                )}
              </div>
            </div>
            {commissionFormat === "PRODUCT_UNIT" && (
              <div className="space-y-2 max-w-xs">
                <Label>Rótulo da unidade</Label>
                <Input value={productUnitLabel} onChange={(e) => setProductUnitLabel(e.target.value)} placeholder="ex: diária grátis" required />
              </div>
            )}
            {commissionFormat === "PERCENTAGE" && (
              <div className="space-y-2 max-w-xs pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-sm text-[#3E2415]">
                  <Checkbox checked={hasFixedExtra} onCheckedChange={(v) => setHasFixedExtra(v === true)} />
                  Ambas (% + R$ Fixo) — somar um valor fixo além da %
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

          <TabsContent value="midia" className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label>Capa do programa</Label>
              <p className="text-xs text-gray-400">Tamanho recomendado: 1200x630px · Máx: 5MB</p>
              <div className="flex items-center gap-3">
                {imageUrl && <img src={imageUrl} alt="Capa" className="w-24 h-14 object-cover rounded-lg border border-gray-200" />}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "program-cover")}
                />
                <Button type="button" variant="outline" size="sm" disabled={isUploadingCover} onClick={() => coverInputRef.current?.click()}>
                  {isUploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {imageUrl ? "Trocar" : "Enviar"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>PDF de regulamento (apresentação)</Label>
              <div className="flex items-center gap-3">
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] flex items-center gap-1">
                    <FileText className="h-4 w-4" /> Ver PDF atual
                  </a>
                )}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "program-pdf")}
                />
                <Button type="button" variant="outline" size="sm" disabled={isUploadingPdf} onClick={() => pdfInputRef.current?.click()}>
                  {isUploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {pdfUrl ? "Trocar" : "Enviar"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <Label>Vídeo institucional (YouTube/Vimeo)</Label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
            </div>
          </TabsContent>

          <TabsContent value="validade" className="space-y-4 pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Checkbox checked={indeterminate} onCheckedChange={(v) => setIndeterminate(v === true)} />
              Prazo indeterminado
            </label>
            {!indeterminate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <Label>Regulamento / Termo de aceite</Label>
              <RichTextEditor
                value={termsContent}
                onChange={setTermsContent}
                placeholder="Texto exibido ao parceiro no primeiro acesso — ele precisa aceitar antes de continuar."
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="brand" disabled={isSaving || program?.status === "ARCHIVED"}>
            {isSaving ? "Salvando..." : "Salvar Programa"}
          </Button>
        </div>
      </form>

      {program && (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100">
          <h3 className="text-base font-bold text-[#3E2415] mb-1">Níveis de Crescimento</h3>
          <p className="text-xs text-gray-500 mb-4">
            Comissão progressiva por desempenho do parceiro (ex: Prata → Ouro → Diamante).
          </p>
          <ProgramLevelsTab />
        </div>
      )}
    </div>
  )
}

function ProgramLevelsTab() {
  const [levels, setLevels] = useState<ProgramLevel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ProgramLevel[]>("/api/company/program/levels").then(setLevels).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleCreate = async (input: ProgramLevelInput) => {
    await adminFetch("/api/company/program/levels", { method: "POST", body: JSON.stringify(input) })
    reload()
  }

  const handleUpdate = async (level: ProgramLevel, input: ProgramLevelInput) => {
    await adminFetch(`/api/company/program/levels/${level.id}`, { method: "PATCH", body: JSON.stringify(input) })
    reload()
  }

  const handleDelete = async (level: ProgramLevel) => {
    if (!confirm(`Excluir o nível "${level.name}"?`)) return
    await adminFetch(`/api/company/program/levels/${level.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <ProgramLevelsManager
      levels={levels}
      isLoading={isLoading}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      uploadEndpoint="/api/company/uploads"
    />
  )
}
