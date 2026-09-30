"use client"

import { useEffect, useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

type Justification = {
  id: string
  date: string
  reason: string
  documentUrl: string | null
  status: "PENDING" | "APPROVED" | "REJECTED"
  employee: { id: string; name: string }
}

export default function CompanyApprovalsPage() {
  const user = useCompanyUser()
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [justifications, setJustifications] = useState<Justification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<RegistrationRequest[]>("/api/company/registration-requests"),
      adminFetch<Justification[]>("/api/company/timeclock/justifications?scope=team"),
    ])
      .then(([r, j]) => {
        setRequests(r)
        setJustifications(j.filter((item) => item.status === "PENDING"))
      })
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

  const handleJustification = async (id: string, status: "APPROVED" | "REJECTED") => {
    const rejectionReason = status === "REJECTED" ? (prompt("Motivo da reprovação (opcional):") ?? undefined) : undefined
    await adminFetch(`/api/company/timeclock/justifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao revisar"))
    reload()
  }

  if (user.role !== "COMPANY_MASTER") {
    return <EmptyState message="Acesso restrito ao Master da empresa." />
  }

  const employeeRequests = requests.filter((r) => r.role === "EMPLOYEE")
  const partnerRequests = requests.filter((r) => r.role === "PARTNER")
  const totalPending = requests.length + justifications.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Aprovações Pendentes</h1>
        <p className="text-gray-600 mt-1 text-sm">Novos cadastros e solicitações internas aguardando sua decisão.</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : totalPending === 0 ? (
        <EmptyState message="Nenhuma solicitação pendente no momento." />
      ) : (
        <Tabs defaultValue="employees">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="employees">Novos Colaboradores ({employeeRequests.length})</TabsTrigger>
            <TabsTrigger value="partners">Novos Parceiros ({partnerRequests.length})</TabsTrigger>
            <TabsTrigger value="internal">Solicitações Internas ({justifications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="mt-4">
            {employeeRequests.length === 0 ? (
              <EmptyState message="Nenhum cadastro de colaborador pendente." />
            ) : (
              <div className="space-y-3">
                {employeeRequests.map((request) => (
                  <RequestRow key={request.id} request={request} onApprove={handleApprove} onReject={handleReject} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="partners" className="mt-4">
            {partnerRequests.length === 0 ? (
              <EmptyState message="Nenhum cadastro de parceiro pendente." />
            ) : (
              <div className="space-y-3">
                {partnerRequests.map((request) => (
                  <RequestRow key={request.id} request={request} onApprove={handleApprove} onReject={handleReject} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="internal" className="mt-4">
            {justifications.length === 0 ? (
              <EmptyState message="Nenhuma solicitação interna pendente (justificativas de ponto)." />
            ) : (
              <div className="space-y-3">
                {justifications.map((j) => (
                  <div
                    key={j.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#3E2415]">{j.employee.name}</p>
                        <span className="text-[10px] font-medium text-[#3E2415] bg-white border border-gray-200 rounded-full px-2 py-0.5">
                          Justificativa de ponto
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(j.date).toLocaleDateString("pt-BR")} · {j.reason}
                      </p>
                      {j.documentUrl && (
                        <a href={j.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] underline">
                          Ver anexo
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" onClick={() => handleJustification(j.id, "APPROVED")} className="bg-green-600 hover:bg-green-700 text-white">
                        <Check className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleJustification(j.id, "REJECTED")}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = { EMPLOYEE: "Colaborador", PARTNER: "Parceiro" }

function RequestRow({
  request,
  onApprove,
  onReject,
}: {
  request: RegistrationRequest
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50">
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
        <Button size="sm" onClick={() => onApprove(request.id)} className="bg-green-600 hover:bg-green-700 text-white">
          <Check className="h-4 w-4 mr-1" />
          Aprovar
        </Button>
        <Button size="sm" variant="outline" onClick={() => onReject(request.id)} className="border-red-200 text-red-600 hover:bg-red-50">
          <X className="h-4 w-4 mr-1" />
          Reprovar
        </Button>
      </div>
    </div>
  )
}
