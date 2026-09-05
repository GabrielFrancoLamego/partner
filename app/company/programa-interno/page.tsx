"use client"

import { useEffect, useState } from "react"
import { Save, Plus, Trash2, ArrowUpCircle, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type Level = {
  id: string
  name: string
  order: number
  pointsRequired: number
  salaryIncreasePercent: string | null
  imageUrl: string | null
  bonusDescription: string | null
  bonusAmount: string | null
  badgeColorHex: string
}
type InternalProgram = {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  pdfUrl: string | null
  termsContent: string | null
  measurementPeriod: "MONTHLY" | "SEMIANNUAL" | "ANNUAL"
  pointsOnTimeCheckIn: number
  pointsChecklistOnTime: number
  pointsChecklistLateOrRejected: number
  pointsOccurrencePenalty: number
  minEfficiencyPercent: number
  efficiencyBonusAmount: string | null
  levels: Level[]
}
type Employee = { id: string; name: string; xpPoints: number; currentLevel: { id: string; name: string } | null }

export default function CompanyProgramaInternoPage() {
  const user = useCompanyUser()
  const allowed = canManageDailyOperations(user.role)

  if (!allowed) return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programa Interno de Colaboradores</h1>
        <p className="text-gray-600 mt-1 text-sm">Regras de pontuação, plano de carreira e termo de aceite — 1 programa por empresa</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="levels">Plano de Carreira</TabsTrigger>
          <TabsTrigger value="promote">Promover Colaborador</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
          <TabsContent value="levels">
            <LevelsTab />
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
  const [pointsOnTimeCheckIn, setPointsOnTimeCheckIn] = useState("5")
  const [pointsChecklistOnTime, setPointsChecklistOnTime] = useState("5")
  const [pointsChecklistLateOrRejected, setPointsChecklistLateOrRejected] = useState("-3")
  const [pointsOccurrencePenalty, setPointsOccurrencePenalty] = useState("-10")
  const [minEfficiencyPercent, setMinEfficiencyPercent] = useState("90")
  const [efficiencyBonusAmount, setEfficiencyBonusAmount] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  useEffect(() => {
    adminFetch<InternalProgram | null>("/api/company/internal-program")
      .then((p) => {
        if (p) {
          setProgram(p)
          setTitle(p.title)
          setDescription(p.description ?? "")
          setTermsContent(p.termsContent ?? "")
          setMeasurementPeriod(p.measurementPeriod)
          setPointsOnTimeCheckIn(String(p.pointsOnTimeCheckIn))
          setPointsChecklistOnTime(String(p.pointsChecklistOnTime))
          setPointsChecklistLateOrRejected(String(p.pointsChecklistLateOrRejected))
          setPointsOccurrencePenalty(String(p.pointsOccurrencePenalty))
          setMinEfficiencyPercent(String(p.minEfficiencyPercent))
          setEfficiencyBonusAmount(p.efficiencyBonusAmount ?? "")
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
      body.append("pointsOnTimeCheckIn", pointsOnTimeCheckIn)
      body.append("pointsChecklistOnTime", pointsChecklistOnTime)
      body.append("pointsChecklistLateOrRejected", pointsChecklistLateOrRejected)
      body.append("pointsOccurrencePenalty", pointsOccurrencePenalty)
      body.append("minEfficiencyPercent", minEfficiencyPercent)
      if (efficiencyBonusAmount) body.append("efficiencyBonusAmount", efficiencyBonusAmount)
      if (imageFile) body.append("image", imageFile)
      if (pdfFile) body.append("pdf", pdfFile)

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
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Imagem representativa</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            {program?.imageUrl && <img src={program.imageUrl} alt="" className="h-16 rounded-lg object-cover mt-1" />}
          </div>
          <div className="space-y-2">
            <Label>Regulamento em PDF</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            {program?.pdfUrl && (
              <a href={program.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline mt-1 w-fit">
                <FileText className="h-3 w-3" /> PDF atual <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Termo de aceite (exibido em modal bloqueante no 1º acesso do colaborador)</Label>
          <Textarea value={termsContent} onChange={(e) => setTermsContent(e.target.value)} rows={6} placeholder="Escreva o termo/regulamento — aceita markdown simples." />
        </div>

        <div className="space-y-2">
          <Label>Período de medição da avaliação</Label>
          <Select value={measurementPeriod} onValueChange={setMeasurementPeriod}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Mensal</SelectItem>
              <SelectItem value="SEMIANNUAL">Semestral</SelectItem>
              <SelectItem value="ANNUAL">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h4 className="font-semibold text-[#3E2415] text-sm mb-3">Regras de Pontuação (XP)</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Entrada pontual no GPS</Label>
              <Input type="number" value={pointsOnTimeCheckIn} onChange={(e) => setPointsOnTimeCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Checklist cumprido no prazo</Label>
              <Input type="number" value={pointsChecklistOnTime} onChange={(e) => setPointsChecklistOnTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Checklist em atraso/reprovado</Label>
              <Input type="number" value={pointsChecklistLateOrRejected} onChange={(e) => setPointsChecklistLateOrRejected(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ocorrência/advertência</Label>
              <Input type="number" value={pointsOccurrencePenalty} onChange={(e) => setPointsOccurrencePenalty(e.target.value)} />
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

        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Save className="h-4 w-4 mr-1" /> Salvar Programa Interno
        </Button>
      </form>
    </AdminCard>
  )
}

function LevelsTab() {
  const [levels, setLevels] = useState<Level[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Level[]>("/api/company/gamification/levels").then(setLevels).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleDelete = async (level: Level) => {
    if (!confirm(`Excluir o cargo "${level.name}"?`)) return
    await adminFetch(`/api/company/gamification/levels/${level.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
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
                  {l.bonusDescription && ` · ${l.bonusDescription}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(l)} className="text-red-600 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {isCreateOpen && (
        <LevelDialog
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function LevelDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [pointsRequired, setPointsRequired] = useState("100")
  const [salaryIncreasePercent, setSalaryIncreasePercent] = useState("")
  const [bonusDescription, setBonusDescription] = useState("")
  const [badgeColorHex, setBadgeColorHex] = useState("#F58220")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/gamification/levels", {
        method: "POST",
        body: JSON.stringify({ name, pointsRequired: Number(pointsRequired), salaryIncreasePercent: salaryIncreasePercent || undefined, bonusDescription, badgeColorHex }),
      })
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao criar cargo")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
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
            <Label>Pontos exigidos para promover ao próximo</Label>
            <Input type="number" value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>% de aumento salarial</Label>
            <Input type="number" step="0.1" value={salaryIncreasePercent} onChange={(e) => setSalaryIncreasePercent(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Bônus associado</Label>
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
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PromoteTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [targetLevelId, setTargetLevelId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const reload = () => {
    setIsLoading(true)
    Promise.all([adminFetch<Employee[]>("/api/company/employees"), adminFetch<Level[]>("/api/company/gamification/levels")])
      .then(([e, l]) => {
        setEmployees(e)
        setLevels(l)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handlePromote = async () => {
    if (!selectedEmployee || !targetLevelId) return
    if (!confirm(`Promover ${selectedEmployee.name}? A pontuação de XP dele será zerada, iniciando um novo ciclo no novo cargo.`)) return
    setIsSubmitting(true)
    setMessage("")
    try {
      await adminFetch(`/api/company/employees/${selectedEmployee.id}/promote`, { method: "POST", body: JSON.stringify({ levelId: targetLevelId }) })
      setMessage(`${selectedEmployee.name} promovido(a) com sucesso — XP zerado no novo cargo.`)
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
                <Button size="sm" disabled={!targetLevelId || isSubmitting} onClick={handlePromote} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
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
