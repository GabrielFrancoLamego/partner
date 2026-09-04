"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X, Banknote, Paperclip, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"

type Withdrawal = {
  id: string
  amount: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  requestDate: string
  pixKey: string | null
  proofOfPaymentUrl: string | null
  company: { id: string; name: string }
  partner: { id: string; name: string; email: string }
}

const currency = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function WithdrawalsTab({ companyId }: { companyId: string }) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const reload = () => {
    setIsLoading(true)
    adminFetch<Withdrawal[]>(`/api/admin/finance/withdrawals?companyId=${companyId}`)
      .then(setWithdrawals)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [companyId])

  const handleUpdate = async (id: string, status: string) => {
    if (status === "REJECTED" && !confirm("Negar este saque?")) return
    await adminFetch(`/api/admin/finance/withdrawals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason: status === "REJECTED" ? "Negado pelo Admin" : undefined }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro"))
    reload()
  }

  const handleUploadProof = async (id: string, file: File | undefined) => {
    if (!file) return
    setUploadingId(id)
    try {
      const body = new FormData()
      body.append("file", file)
      await adminFetch(`/api/admin/finance/withdrawals/${id}/proof`, { method: "POST", body })
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
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Parceiro</th>
            <th className="px-4 py-3 font-medium">Empresa</th>
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
                <td className="px-4 py-3 text-gray-600">{withdrawal.company.name}</td>
                <td className="px-4 py-3 font-semibold text-[#3E2415]">{currency(withdrawal.amount)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(withdrawal.requestDate).toLocaleDateString("pt-BR")}
                </td>
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
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Paperclip className="h-4 w-4" />
                          )}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdate(withdrawal.id, "APPROVED")}
                        title="Aprovar"
                        className="text-green-600"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdate(withdrawal.id, "REJECTED")}
                        title="Negar"
                        className="text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {withdrawal.status === "APPROVED" && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdate(withdrawal.id, "PAID")}
                        title="Marcar como pago"
                        className="text-green-600"
                      >
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
