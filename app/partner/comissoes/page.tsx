"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"

type Commission = {
  id: string
  clientName: string
  amount: string | null
  commissionValue: string | null
  status: string
  date: string
  company: { id: string; name: string }
  promotion: { id: string; title: string } | null
  unit: { id: string; name: string } | null
}

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "AWAITING_VALUE", label: "Aguardando valor" },
  { value: "PENDING", label: "Aguardando aprovação" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "PAID", label: "Pagas" },
  { value: "REJECTED", label: "Reprovadas" },
]

const currency = (value: string | null) => (value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))

export default function PartnerCommissionsPage() {
  const [status, setStatus] = useState("all")
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<Commission[]>(`/api/partner/commissions?status=${status}`)
      .then(setCommissions)
      .finally(() => setIsLoading(false))
  }, [status])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Extrato de Comissões</h1>
        <p className="text-gray-600 mt-1 text-sm">Todas as suas indicações e o status de cada comissão</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => setStatus(f.value)}
            className={status === f.value ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white" : ""}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : commissions.length === 0 ? (
        <EmptyState message="Nenhuma comissão encontrada para este filtro." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Valor da conta</th>
                <th className="px-4 py-3 font-medium">Comissão</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commissions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#3E2415]">{c.clientName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.company.name}
                    {c.promotion && <span className="block text-xs text-gray-400">{c.promotion.title}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(c.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-gray-600">{currency(c.amount)}</td>
                  <td className="px-4 py-3 font-semibold text-[#3E2415]">{currency(c.commissionValue)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
