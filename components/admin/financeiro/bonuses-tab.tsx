"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"

type Bonus = {
  id: string
  amount: string
  description: string
  createdAt: string
  company: { id: string; name: string }
  partner: { id: string; name: string; employeeProfile: { xpPoints: number } | null }
  createdBy: { id: string; name: string } | null
}

const currency = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function BonusesTab({ companyId }: { companyId: string }) {
  const { companies } = useCompanies()
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Bonus[]>(`/api/admin/finance/bonuses?companyId=${companyId}`)
      .then(setBonuses)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [companyId])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Conceder Prêmio
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : bonuses.length === 0 ? (
        <EmptyState message="Nenhum bônus concedido ainda." />
      ) : (
        <div className="grid gap-2">
          {bonuses.map((bonus) => (
            <div
              key={bonus.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-[#3E2415] text-sm">
                  {bonus.partner.name} · {bonus.company.name}
                </p>
                <p className="text-xs text-gray-500">{bonus.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-green-600">{currency(bonus.amount)}</p>
                <p className="text-xs text-gray-400">{new Date(bonus.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <GrantBonusDialog
          companies={companies}
          onClose={() => setIsCreateOpen(false)}
          onGranted={() => {
            setIsCreateOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function GrantBonusDialog({
  companies,
  onClose,
  onGranted,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
  onGranted: () => void
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "")
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [employeeId, setEmployeeId] = useState("")
  const [amount, setAmount] = useState("")
  const [xp, setXp] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!companyId) return
    adminFetch<{ id: string; name: string }[]>(`/api/admin/users?role=EMPLOYEE&companyId=${companyId}`).then(
      setEmployees,
    )
  }, [companyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/admin/finance/bonuses", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          amount: amount ? Number(amount) : undefined,
          xp: xp ? Number(xp) : undefined,
          description,
        }),
      })
      onGranted()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao conceder prêmio")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conceder Bônus / Premiação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
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
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pontos de XP</Label>
              <Input type="number" value={xp} onChange={(e) => setXp(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !employeeId}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Conceder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
