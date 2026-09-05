"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X, Banknote, Paperclip, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageFinance } from "@/lib/permissions"

type Withdrawal = {
  id: string
  amount: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  requestDate: string
  pixKey: string | null
  proofOfPaymentUrl: string | null
  partner: { id: string; name: string; email: string }
}

type Commission = {
  id: string
  clientName: string
  amount: string | null
  commissionValue: string | null
  status: "AWAITING_VALUE" | "PENDING" | "APPROVED" | "PAID" | "REJECTED"
  date: string
  billAttachmentUrl: string | null
  partner: { id: string; name: string; email: string }
  promotion: { id: string; title: string } | null
}

const currency = (value: string | null) => (value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))

export default function CompanyFinanceiroPage() {
  const user = useCompanyUser()
  const allowed = canManageFinance(user.role)

  if (!allowed) {
    return <EmptyState message="Acesso restrito ao Financeiro e ao Administrador da empresa." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Financeiro</h1>
        <p className="text-gray-600 mt-1 text-sm">Comissões e saques PIX dos parceiros de {user.companyName}</p>
      </div>

      <Tabs defaultValue="commissions">
        <TabsList>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Saques PIX</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="commissions">
            <CommissionsList />
          </TabsContent>
          <TabsContent value="withdrawals">
            <WithdrawalsList />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function CommissionsList() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<Commission[]>("/api/company/finance/commissions").then(setCommissions).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleUpdate = async (id: string, status: "APPROVED" | "REJECTED" | "PAID") => {
    if (status === "REJECTED" && !confirm("Reprovar esta comissão? Ela não será creditada na carteira do parceiro.")) return
    await adminFetch(`/api/company/finance/commissions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    reload()
  }

  if (isLoading) return <LoadingState />
  if (commissions.length === 0) return <EmptyState message="Nenhuma comissão registrada ainda." />

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Parceiro</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Comprovante</th>
            <th className="px-4 py-3 font-medium">Comissão</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {commissions.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-semibold text-[#3E2415]">{c.partner.name}</td>
              <td className="px-4 py-3 text-gray-600">
                {c.clientName}
                {c.promotion && <span className="block text-xs text-gray-400">{c.promotion.title}</span>}
              </td>
              <td className="px-4 py-3 text-gray-600">{new Date(c.date).toLocaleDateString("pt-BR")}</td>
              <td className="px-4 py-3">
                {c.billAttachmentUrl ? (
                  <a href={c.billAttachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline">
                    Ver <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 font-semibold text-[#3E2415]">{currency(c.commissionValue)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {(c.status === "PENDING" || c.status === "AWAITING_VALUE") && (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(c.id, "APPROVED")}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleUpdate(c.id, "REJECTED")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {c.status === "APPROVED" && (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(c.id, "PAID")}>
                      <Banknote className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WithdrawalsList() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const reload = () => {
    setIsLoading(true)
    adminFetch<Withdrawal[]>("/api/company/finance/withdrawals").then(setWithdrawals).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleUpdate = async (id: string, status: string) => {
    if (status === "REJECTED" && !confirm("Negar este saque? O valor será estornado à carteira do parceiro.")) return
    await adminFetch(`/api/company/finance/withdrawals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason: status === "REJECTED" ? "Negado pelo Financeiro" : undefined }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleUploadProof = async (id: string, file: File | undefined) => {
    if (!file) return
    setUploadingId(id)
    try {
      const body = new FormData()
      body.append("file", file)
      await adminFetch(`/api/company/finance/withdrawals/${id}/proof`, { method: "POST", body })
      reload()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao enviar comprovante")
    } finally {
      setUploadingId(null)
    }
  }

  if (isLoading) return <LoadingState />
  if (withdrawals.length === 0) return <EmptyState message="Nenhum saque solicitado ainda." />

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Parceiro</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Comprovante</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {withdrawals.map((withdrawal) => {
            const isUploading = uploadingId === withdrawal.id
            return (
              <tr key={withdrawal.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#3E2415]">{withdrawal.partner.name}</p>
                  <p className="text-xs text-gray-500">{withdrawal.pixKey ?? "—"}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-[#3E2415]">{currency(withdrawal.amount)}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(withdrawal.requestDate).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {withdrawal.proofOfPaymentUrl && (
                      <a
                        href={withdrawal.proofOfPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-[#F58220] hover:underline"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {withdrawal.status !== "REJECTED" && (
                      <>
                        <input
                          ref={(el) => {
                            fileInputRefs.current[withdrawal.id] = el
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => handleUploadProof(withdrawal.id, e.target.files?.[0])}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[withdrawal.id]?.click()}
                          title={withdrawal.proofOfPaymentUrl ? "Trocar comprovante" : "Anexar comprovante PIX"}
                        >
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={withdrawal.status} />
                </td>
                <td className="px-4 py-3">
                  {withdrawal.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(withdrawal.id, "APPROVED")}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleUpdate(withdrawal.id, "REJECTED")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {withdrawal.status === "APPROVED" && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(withdrawal.id, "PAID")}>
                        <Banknote className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
