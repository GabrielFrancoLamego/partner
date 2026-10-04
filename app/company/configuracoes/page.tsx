"use client"

import { useEffect, useState } from "react"
import { Settings2, CheckCircle2, CalendarDays, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, AdminCard, EmptyState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canConfigureCompany } from "@/lib/permissions"

type Settings = {
  shiftClosingDeadline: string
  operatingShift1Start: string | null
  operatingShift1End: string | null
  operatingShift2Start: string | null
  operatingShift2End: string | null
}

export default function CompanyConfiguracoesPage() {
  const user = useCompanyUser()

  if (!canConfigureCompany(user.role)) {
    return <EmptyState message="Acesso restrito ao Master da empresa." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Configurações da Empresa</h1>
        <p className="text-gray-600 mt-1 text-sm">Horário-limite do fechamento diário e turnos de funcionamento.</p>
      </div>
      <SettingsForm />
      <CalendarEventsForm />
    </div>
  )
}

type CalendarEvent = { id: string; date: string; kind: "HOLIDAY" | "CLOSED"; isPaidHoliday: boolean; label: string | null }

/** Feriados e Dias Fechados do estabelecimento — num dia CLOSED, o colaborador não tem checklist gerado nem é penalizado por "não entrega" (ver lib/checklist-engine.ts e .../shift-closing). */
function CalendarEventsForm() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [date, setDate] = useState("")
  const [kind, setKind] = useState<"HOLIDAY" | "CLOSED">("HOLIDAY")
  const [isPaidHoliday, setIsPaidHoliday] = useState(false)
  const [label, setLabel] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<CalendarEvent[]>("/api/company/calendar-events")
      .then(setEvents)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!date) {
      setError("Informe a data")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/calendar-events", {
        method: "POST",
        body: JSON.stringify({ date, kind, isPaidHoliday: kind === "HOLIDAY" ? isPaidHoliday : false, label }),
      })
      setDate("")
      setLabel("")
      setIsPaidHoliday(false)
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao cadastrar")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (event: CalendarEvent) => {
    if (!confirm(`Remover ${event.kind === "HOLIDAY" ? "o feriado" : "o dia fechado"} de ${new Date(event.date).toLocaleDateString("pt-BR")}?`)) return
    await adminFetch(`/api/company/calendar-events/${event.id}`, { method: "DELETE" }).catch(() => {})
    reload()
  }

  return (
    <AdminCard title="Calendário Operacional — Feriados e Dias Fechados" icon={CalendarDays}>
      <p className="text-xs text-gray-500 mb-4">
        Num dia marcado como "Fechado", a empresa não abre — o colaborador não tem checklist gerado nem é penalizado por falta de entrega naquele dia.
      </p>
      <form onSubmit={handleAdd} className="grid sm:grid-cols-4 gap-3 mb-5 items-end">
        {error && <p className="text-sm text-red-600 col-span-full">{error}</p>}
        <div className="space-y-2">
          <Label className="text-xs">Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as "HOLIDAY" | "CLOSED")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOLIDAY">Feriado</SelectItem>
              <SelectItem value="CLOSED">Dia Fechado do Estabelecimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Descrição (opcional)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Natal" />
        </div>
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
        {kind === "HOLIDAY" && (
          <label className="flex items-center gap-2 text-sm text-gray-700 col-span-full">
            <Checkbox checked={isPaidHoliday} onCheckedChange={(v) => setIsPaidHoliday(v === true)} />
            Compra de Feriado (empresa opera e paga o adicional, em vez de dar folga)
          </label>
        )}
      </form>

      {isLoading ? (
        <LoadingState />
      ) : events.length === 0 ? (
        <EmptyState message="Nenhum feriado ou dia fechado cadastrado ainda." />
      ) : (
        <div className="grid gap-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
              <div>
                <p className="text-sm font-medium text-[#3E2415]">
                  {new Date(e.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                  {e.label && ` — ${e.label}`}
                </p>
                <p className="text-xs text-gray-500">
                  {e.kind === "HOLIDAY" ? "Feriado" : "Dia Fechado do Estabelecimento"}
                  {e.kind === "HOLIDAY" && e.isPaidHoliday && " · Compra de Feriado"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(e)} className="text-red-600 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    adminFetch<Settings>("/api/company/settings")
      .then(setSettings)
      .finally(() => setIsLoading(false))
  }, [])

  const update = (field: keyof Settings, value: string) => {
    setSettings((s) => (s ? { ...s, [field]: value || null } : s))
    setSuccess(false)
  }

  const handleSave = async () => {
    if (!settings) return
    setError("")
    setIsSaving(true)
    try {
      const saved = await adminFetch<Settings>("/api/company/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      })
      setSettings(saved)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar configurações")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !settings) return <LoadingState />

  return (
    <AdminCard title="Fechamento e Horário de Funcionamento" icon={Settings2}>
      <div className="space-y-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Configurações salvas com sucesso.
          </div>
        )}

        <div className="space-y-2">
          <Label>Horário-limite do fechamento diário *</Label>
          <Input
            type="time"
            value={settings.shiftClosingDeadline}
            onChange={(e) => update("shiftClosingDeadline", e.target.value)}
            className="w-40"
          />
          <p className="text-xs text-gray-400">
            Depois deste horário, o fechamento do dia é marcado como atrasado — a Gerente ainda pode concluí-lo, mas
            o Master é avisado automaticamente.
          </p>
        </div>

        <div className="space-y-3">
          <Label>Turno 1 de funcionamento</Label>
          <div className="flex items-center gap-3">
            <Input type="time" value={settings.operatingShift1Start ?? ""} onChange={(e) => update("operatingShift1Start", e.target.value)} className="w-32" />
            <span className="text-sm text-gray-400">até</span>
            <Input type="time" value={settings.operatingShift1End ?? ""} onChange={(e) => update("operatingShift1End", e.target.value)} className="w-32" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Turno 2 de funcionamento (opcional)</Label>
          <div className="flex items-center gap-3">
            <Input type="time" value={settings.operatingShift2Start ?? ""} onChange={(e) => update("operatingShift2Start", e.target.value)} className="w-32" />
            <span className="text-sm text-gray-400">até</span>
            <Input type="time" value={settings.operatingShift2End ?? ""} onChange={(e) => update("operatingShift2End", e.target.value)} className="w-32" />
          </div>
          <p className="text-xs text-gray-400">Deixe em branco se a empresa funcionar em turno único.</p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          Salvar Configurações
        </Button>
      </div>
    </AdminCard>
  )
}
