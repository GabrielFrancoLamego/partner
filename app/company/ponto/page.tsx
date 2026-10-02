"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogIn, Coffee, LogOut as LogOutIcon, RotateCcw, MapPin, Loader2, FileText, Check, X, AlertTriangle, Pencil, FileDown, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations, isCompanyMasterOrAdmin } from "@/lib/permissions"

type EntryType = "CHECK_IN" | "BREAK_START" | "BREAK_END" | "CHECK_OUT"

const TYPE_LABELS: Record<EntryType, string> = {
  CHECK_IN: "Entrada",
  BREAK_START: "Pausa",
  BREAK_END: "Retorno",
  CHECK_OUT: "Saída",
}
const NEXT: Record<"START" | EntryType, EntryType> = {
  START: "CHECK_IN",
  CHECK_IN: "BREAK_START",
  BREAK_START: "BREAK_END",
  BREAK_END: "CHECK_OUT",
  CHECK_OUT: "CHECK_IN",
}
const TYPE_ICONS: Record<EntryType, typeof LogIn> = {
  CHECK_IN: LogIn,
  BREAK_START: Coffee,
  BREAK_END: RotateCcw,
  CHECK_OUT: LogOutIcon,
}

type TimeEntry = {
  id: string
  type: EntryType
  createdAt: string
  latitude: string
  longitude: string
  user: { id: string; name: string }
  isManagerAdjusted?: boolean
}

export default function CompanyPontoPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)
  const isMaster = isCompanyMasterOrAdmin(user.role)
  const isEmployee = user.role === "EMPLOYEE"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Ponto Digital</h1>
          <p className="text-gray-600 mt-1 text-sm">Batida por GPS com validação de raio da unidade</p>
        </div>
        {isManager && (
          <Link href="/company/ponto/relatorio">
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1.5" /> Exportar Relatório em PDF
            </Button>
          </Link>
        )}
      </div>

      {isManager && <OvertimeAlerts />}

      {isEmployee && <ClockWidget />}

      {isManager ? (
        <Tabs defaultValue="mirror">
          <TabsList>
            <TabsTrigger value="mirror">Espelho da Equipe</TabsTrigger>
            <TabsTrigger value="justifications">Justificativas</TabsTrigger>
          </TabsList>
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
            <TabsContent value="mirror">
              <Mirror scope="team" canAdjust={isMaster} />
            </TabsContent>
            <TabsContent value="justifications">
              <JustificationsPanel isManager />
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <AdminCard title="Meu Espelho de Ponto">
          <Mirror scope="me" canAdjust={false} />
        </AdminCard>
      )}

      {isEmployee && <JustificationRequestForm />}
    </div>
  )
}

type OvertimeAlert = { employeeId: string; name: string; workEndTime: string; minutesToEnd: number; status: "approaching" | "overtime" }

function OvertimeAlerts() {
  const [alerts, setAlerts] = useState<OvertimeAlert[]>([])

  useEffect(() => {
    const load = () => adminFetch<OvertimeAlert[]>("/api/company/timeclock/alerts").then(setAlerts).catch(() => {})
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.employeeId}
          className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${
            a.status === "overtime" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <Timer className="h-4 w-4 flex-shrink-0" />
          {a.status === "overtime" ? (
            <span>
              <strong>{a.name}</strong> já ultrapassou o horário previsto ({a.workEndTime}) — está gerando hora extra.
            </span>
          ) : (
            <span>
              <strong>{a.name}</strong> está a {a.minutesToEnd}min de estourar a jornada ({a.workEndTime}).
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function ClockWidget() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [lastType, setLastType] = useState<"START" | EntryType>("START")

  useEffect(() => {
    adminFetch<TimeEntry[]>("/api/company/timeclock?days=1").then((entries) => {
      if (entries.length > 0) setLastType(entries[0].type)
    })
  }, [])

  const expected = NEXT[lastType]

  const handleClock = () => {
    setError("")
    setSuccess("")
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada neste dispositivo")
      return
    }
    setIsSubmitting(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await adminFetch("/api/company/timeclock", {
            method: "POST",
            body: JSON.stringify({
              type: expected,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          })
          setLastType(expected)
          setSuccess(`${TYPE_LABELS[expected]} registrada com sucesso`)
        } catch (e) {
          setError(e instanceof AdminApiError ? e.message : "Erro ao registrar ponto")
        } finally {
          setIsSubmitting(false)
        }
      },
      () => {
        setError("Não foi possível obter sua localização — verifique a permissão de GPS")
        setIsSubmitting(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const Icon = TYPE_ICONS[expected]

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] flex items-center justify-center">
        <Icon className="w-7 h-7 text-white" />
      </div>
      <p className="text-sm text-gray-500 mb-1">Próxima batida</p>
      <p className="text-xl font-bold text-[#3E2415] mb-4">{TYPE_LABELS[expected]}</p>
      <Button
        onClick={handleClock}
        disabled={isSubmitting}
        className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 px-8 py-6 text-base rounded-xl"
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <MapPin className="h-5 w-5 mr-2" />}
        Bater Ponto
      </Button>
      {error && (
        <div className="flex items-start gap-2 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-left">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
      {success && <p className="text-sm text-green-600 mt-3">{success}</p>}
    </div>
  )
}

function Mirror({ scope, canAdjust }: { scope: "me" | "team"; canAdjust: boolean }) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [adjusting, setAdjusting] = useState<TimeEntry | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<TimeEntry[]>(`/api/company/timeclock?scope=${scope}&days=15`)
      .then(setEntries)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [scope])

  if (isLoading) return <LoadingState />
  if (entries.length === 0) return <EmptyState message="Nenhuma batida registrada nos últimos 15 dias." />

  return (
    <>
      <TableDesktop>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              {scope === "team" && <th className="px-4 py-3 font-medium">Colaborador</th>}
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Data/Hora</th>
              {canAdjust && <th className="px-4 py-3 font-medium text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                {scope === "team" && <td className="px-4 py-3 font-medium text-[#3E2415]">{e.user.name}</td>}
                <td className="px-4 py-3 text-gray-600">
                  {TYPE_LABELS[e.type]}
                  {e.isManagerAdjusted && <span className="ml-1 text-xs text-[#F58220]">(corrigido)</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                {canAdjust && (
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setAdjusting(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableDesktop>

      <MobileCardList>
        {entries.map((e) => (
          <MobileCard
            key={e.id}
            title={scope === "team" ? e.user.name : TYPE_LABELS[e.type]}
            subtitle={new Date(e.createdAt).toLocaleString("pt-BR")}
            badges={
              scope === "team" ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                  {TYPE_LABELS[e.type]}
                </span>
              ) : undefined
            }
            actions={
              canAdjust ? (
                <button onClick={() => setAdjusting(e)} className="text-xs text-[#F58220] underline">
                  Corrigir
                </button>
              ) : undefined
            }
          />
        ))}
      </MobileCardList>

      {adjusting && (
        <AdjustEntryDialog entry={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); reload() }} />
      )}
    </>
  )
}

function AdjustEntryDialog({ entry, onClose, onSaved }: { entry: TimeEntry; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<EntryType>(entry.type)
  const [createdAt, setCreatedAt] = useState(() => {
    const d = new Date(entry.createdAt)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/timeclock/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ type, createdAt: new Date(createdAt).toISOString(), note }),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao corrigir batida")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corrigir batida — {entry.user.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as EntryType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data/Hora</Label>
            <Input type="datetime-local" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Motivo da correção</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: esqueceu de bater a saída" />
          </div>
          <p className="text-xs text-gray-400">O colaborador será notificado da correção e precisará dar ciência.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Salvar Correção
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Justification = {
  id: string
  date: string
  reason: string
  documentUrl: string | null
  status: "PENDING" | "APPROVED" | "REJECTED"
  employee: { id: string; name: string }
}

function JustificationsPanel({ isManager }: { isManager: boolean }) {
  const [items, setItems] = useState<Justification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Justification[]>(`/api/company/timeclock/justifications${isManager ? "?scope=team" : ""}`)
      .then(setItems)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [isManager])

  const handleReview = async (item: Justification, status: "APPROVED" | "REJECTED") => {
    await adminFetch(`/api/company/timeclock/justifications/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  if (isLoading) return <LoadingState />
  if (items.length === 0) return <EmptyState message="Nenhuma justificativa registrada." />

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="p-3 rounded-xl border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[#3E2415] text-sm">
                {isManager && `${item.employee.name} · `}
                {new Date(item.date).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
              {item.documentUrl && (
                <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] hover:underline flex items-center gap-1 mt-1">
                  <FileText className="h-3 w-3" /> Ver documento
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={item.status} />
              {isManager && item.status === "PENDING" && (
                <>
                  <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleReview(item, "APPROVED")}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleReview(item, "REJECTED")}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function JustificationRequestForm() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage("")
    try {
      const body = new FormData()
      body.append("date", date)
      body.append("reason", reason)
      if (file) body.append("file", file)
      await adminFetch("/api/company/timeclock/justifications", { method: "POST", body })
      setReason("")
      setFile(null)
      setMessage("Solicitação enviada para revisão da gerência.")
    } catch (e) {
      setMessage(e instanceof AdminApiError ? e.message : "Erro ao enviar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminCard title="Solicitar Justificativa">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Atestado/documento (opcional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Motivo</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        {message && <p className="text-sm text-gray-600">{message}</p>}
        <Button type="submit" disabled={isSubmitting || !reason.trim()} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          Enviar Solicitação
        </Button>
      </form>
    </AdminCard>
  )
}
