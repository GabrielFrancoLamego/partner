"use client"

import { useEffect, useState } from "react"
import { Settings2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    </div>
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
