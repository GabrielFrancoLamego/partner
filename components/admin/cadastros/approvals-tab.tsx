"use client"

import { useEffect, useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"

type RegistrationRequest = {
  id: string
  name: string
  email: string
  phone: string
  document: string | null
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  createdAt: string
  company: { id: string; name: string }
  link: { role: string }
  reviewedBy: { name: string } | null
}

export function ApprovalsTab() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<RegistrationRequest[]>("/api/admin/registration-requests?status=PENDING_APPROVAL")
      .then(setRequests)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [])

  const handleApprove = async (id: string) => {
    await adminFetch(`/api/admin/registration-requests/${id}/approve`, { method: "POST" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao aprovar"),
    )
    reload()
  }

  const handleReject = async (id: string) => {
    const reason = prompt("Motivo da reprovação (opcional):") ?? undefined
    await adminFetch(`/api/admin/registration-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao reprovar"))
    reload()
  }

  if (isLoading) return <LoadingState />
  if (requests.length === 0) {
    return <EmptyState message="Nenhum cadastro pendente de aprovação. Links públicos compartilhados aparecem aqui quando alguém se cadastra." />
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[#3E2415]">{request.name}</p>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {request.email} · {request.phone}
            </p>
            <p className="text-xs text-gray-500">
              {request.company.name} · via link de auto-cadastro ({request.link.role})
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => handleApprove(request.id)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(request.id)}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Reprovar
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
