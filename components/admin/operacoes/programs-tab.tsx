"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Power, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"

type CommissionFormat = "PERCENTAGE" | "FIXED_VALUE" | "PRODUCT_UNIT"

type Program = {
  id: string
  name: string
  description: string
  commissionType: "FIXED" | "VARIABLE"
  commissionValue: string
  commissionFormat: CommissionFormat
  productUnitLabel: string | null
  imageUrl: string | null
  pdfUrl: string | null
  videoUrl: string | null
  termsContent: string | null
  active: boolean
  company: { id: string; name: string }
  _count: { referrals: number }
}

const FORMAT_LABELS: Record<CommissionFormat, string> = {
  PERCENTAGE: "Percentual (%)",
  FIXED_VALUE: "Valor fixo (R$)",
  PRODUCT_UNIT: "Unidade de produto",
}

/** Exibe o valor de comissão com o sufixo correto conforme o formato configurado. */
function formatCommissionValue(program: Pick<Program, "commissionFormat" | "commissionValue" | "productUnitLabel">) {
  switch (program.commissionFormat) {
    case "PERCENTAGE":
      return `${program.commissionValue}%`
    case "FIXED_VALUE":
      return `R$ ${program.commissionValue}`
    case "PRODUCT_UNIT":
      return `${program.commissionValue}x ${program.productUnitLabel ?? "unidade"}`
  }
}

export function ProgramsTab() {
  const { companies } = useCompanies()
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Program | "new" | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Program[]>("/api/admin/programs")
      .then(setPrograms)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleToggleActive = async (program: Program) => {
    await adminFetch(`/api/admin/programs/${program.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !program.active }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleDelete = async (program: Program) => {
    if (!confirm(`Excluir o programa "${program.name}"?`)) return
    await adminFetch(`/api/admin/programs/${program.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setEditing("new")}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#3E2415]">{program.name}</p>
                    <StatusBadge status={program.active ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{program.company.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Comissão: {formatCommissionValue(program)} ({program.commissionType === "FIXED" ? "fixa" : "variável"}) ·{" "}
                    {program._count.referrals} indicações
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(program)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(program)}
                    title={program.active ? "Inativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(program)}
                    title="Excluir"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
    </div>
  )
}

function ProgramDialog({
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
  const [commissionType, setCommissionType] = useState<"FIXED" | "VARIABLE">(program?.commissionType ?? "VARIABLE")
  const [commissionFormat, setCommissionFormat] = useState<CommissionFormat>(program?.commissionFormat ?? "PERCENTAGE")
  const [commissionValue, setCommissionValue] = useState(program?.commissionValue ?? "")
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
    setIsSubmitting(true)
    try {
      const payload = {
        name,
        description,
        commissionType,
        commissionValue: Number(commissionValue),
        commissionFormat,
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
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Tabs defaultValue="comissao">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="comissao">Comissão</TabsTrigger>
              <TabsTrigger value="midia">Mídias & Regulamento</TabsTrigger>
            </TabsList>

            <TabsContent value="comissao" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de comissão</Label>
                  <Select value={commissionType} onValueChange={(v) => setCommissionType(v as "FIXED" | "VARIABLE")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixa</SelectItem>
                      <SelectItem value="VARIABLE">Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato do valor</Label>
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
                </div>
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
            </TabsContent>

            <TabsContent value="midia" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Foto de capa (URL)</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Anexo PDF — apresentação (URL)</Label>
                <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Vídeo institucional (URL)</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Regulamento / Termo de aceite</Label>
                <Textarea
                  value={termsContent}
                  onChange={(e) => setTermsContent(e.target.value)}
                  placeholder="Texto exibido ao parceiro no primeiro acesso, que ele precisa aceitar..."
                  rows={5}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
