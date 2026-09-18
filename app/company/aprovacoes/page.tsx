"use client"

import { useEffect, useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"

type RegistrationRequest = {
  id: string
  name: string
  email: string
  phone: string
  document: string | null
  role: "EMPLOYEE" | "PARTNER"
  status: "PENDING_APPROVAL"
  createdAt: string
  sector: { name: string } | null
}

const ROLE_LABELS: Record<string, string> = { EMPLOYEE: "Colaborador", PARTNER: "Parceiro" }

export default function CompanyApprovalsPage() {
  const user = useCompanyUser()
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<RegistrationRequest[]>("/api/company/registration-requests")
      .then(setRequests)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleApprove = async (id: string) => {
    await adminFetch(`/api/company/registration-requests/${id}/approve`, { method: "POST" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao aprovar"),
    )
    reload()
  }

  const handleReject = async (id: string) => {
    const reason = prompt("Motivo da reprovação (opcional):") ?? undefined
    await adminFetch(`/api/company/registration-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao reprovar"))
    reload()
  }

  if (user.role !== "COMPANY_MASTER") {
    return <EmptyState message="Acesso restrito ao Master da empresa." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Aprovações Pendentes</h1>
        <p className="text-gray-600 mt-1 text-sm">Cadastros recebidos via link público, aguardando sua aprovação</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState message="Nenhum cadastro pendente de aprovação no momento." />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#3E2415]">{request.name}</p>
                  <StatusBadge status={request.status} />
                  <span className="text-[10px] font-medium text-[#3E2415] bg-white border border-gray-200 rounded-full px-2 py-0.5">
                    {ROLE_LABELS[request.role] ?? request.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {request.email} · {request.phone}
                  {request.sector && ` · ${request.sector.name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => handleApprove(request.id)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Check className="h-4 w-4 mr-1" />
                  Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleReject(request.id)} className="border-red-200 text-red-600 hover:bg-red-50">
                  <X className="h-4 w-4 mr-1" />
                  Reprovar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
