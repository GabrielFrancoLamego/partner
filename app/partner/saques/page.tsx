"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge, AdminCard } from "@/components/admin/admin-ui"

type Commission = { company: { id: string; name: string } }
type Withdrawal = {
  id: string
  amount: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  requestDate: string
  pixKey: string | null
  proofOfPaymentUrl: string | null
  rejectionReason: string | null
  company: { id: string; name: string }
}
type DashboardSummary = { walletBalance: number }

const currency = (value: string | number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function PartnerWithdrawalsPage() {
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [companyId, setCompanyId] = useState("")
  const [amount, setAmount] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<DashboardSummary>("/api/partner/dashboard"),
      adminFetch<Commission[]>("/api/partner/commissions"),
      adminFetch<Withdrawal[]>("/api/partner/withdrawals"),
    ])
      .then(([dashboard, commissions, withdrawalsList]) => {
        setWalletBalance(dashboard.walletBalance)
        const uniqueCompanies = Array.from(new Map(commissions.map((c) => [c.company.id, c.company])).values())
        setCompanies(uniqueCompanies)
        setCompanyId((prev) => prev || uniqueCompanies[0]?.id || "")
        setWithdrawals(withdrawalsList)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const maxAmount = walletBalance ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    const amountNumber = Number(amount)
    if (!companyId) {
      setError("Selecione a empresa")
      return
    }
    if (!amountNumber || amountNumber <= 0) {
      setError("Informe um valor válido")
      return
    }
    if (amountNumber > maxAmount) {
      setError("Valor solicitado é maior que o saldo disponível em carteira")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch("/api/partner/withdrawals", {
        method: "POST",
        body: JSON.stringify({ companyId, amount: amountNumber, pixKey: pixKey || undefined }),
      })
      setAmount("")
      setSuccess("Saque solicitado com sucesso! Aguarde a aprovação do financeiro.")
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao solicitar saque")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Saques PIX</h1>
        <p className="text-gray-600 mt-1 text-sm">Solicite o saque do seu saldo em carteira</p>
      </div>

      <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-5 text-white shadow-lg">
        <p className="text-sm opacity-90">Saldo disponível</p>
        <p className="text-3xl font-bold">{currency(maxAmount)}</p>
      </div>

      {companies.length === 0 ? (
        <EmptyState message="Você ainda não possui histórico de comissões em nenhuma empresa." />
      ) : (
        <AdminCard title="Nova Solicitação">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
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
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" max={maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX (opcional — usa a cadastrada no perfil se vazio)</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
            </div>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Solicitar Saque
            </Button>
          </form>
        </AdminCard>
      )}

      <div className="space-y-3">
        <h4 className="font-semibold text-[#3E2415]">Histórico de Saques</h4>
        {withdrawals.length === 0 ? (
          <EmptyState message="Nenhum saque solicitado ainda." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Comprovante</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{w.company.name}</td>
                    <td className="px-4 py-3 font-semibold text-[#3E2415]">{currency(w.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(w.requestDate).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      {w.proofOfPaymentUrl ? (
                        <a href={w.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline">
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                      {w.rejectionReason && <p className="text-xs text-red-500 mt-0.5">{w.rejectionReason}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
