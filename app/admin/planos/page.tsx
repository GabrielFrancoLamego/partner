"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { usePlans } from "@/components/admin/use-plans"
import { AdminCard, LoadingState } from "@/components/admin/admin-ui"
import type { PlanDefinition } from "@/lib/plans"

export default function AdminPlansPage() {
  const { plans, isLoading, reload } = usePlans()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Planos & Preços</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Limites de colaboradores/parceiros e valores praticados por plano — usados no cadastro de novas empresas e
          no dashboard de saúde SaaS.
        </p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSaved={reload} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, onSaved }: { plan: PlanDefinition; onSaved: () => void }) {
  const [label, setLabel] = useState(plan.label)
  const [maxEmployees, setMaxEmployees] = useState(String(plan.maxEmployees))
  const [maxPartners, setMaxPartners] = useState(String(plan.maxPartners))
  const [oneTimePrice, setOneTimePrice] = useState(String(plan.oneTimePrice))
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan.monthlyPrice))
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setError("")
    setSaved(false)
    setIsSaving(true)
    try {
      await adminFetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label,
          maxEmployees: Number(maxEmployees),
          maxPartners: Number(maxPartners),
          oneTimePrice: Number(oneTimePrice),
          monthlyPrice: Number(monthlyPrice),
        }),
      })
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminCard title={plan.label}>
      <div className="space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do plano</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Max. colaboradores</Label>
            <Input type="number" value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max. parceiros</Label>
            <Input type="number" value={maxPartners} onChange={(e) => setMaxPartners(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor avulso (R$)</Label>
            <Input type="number" step="0.01" value={oneTimePrice} onChange={(e) => setOneTimePrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor mensal (R$)</Label>
            <Input type="number" step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
        >
          <Save className="h-4 w-4 mr-2" />
          {saved ? "Salvo!" : "Salvar"}
        </Button>
      </div>
    </AdminCard>
  )
}
