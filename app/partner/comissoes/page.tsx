"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Wallet, TrendingUp, Banknote, ExternalLink, UserCircle2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { AdesaoGateDialog } from "@/components/partner/adesao-gate-dialog"

type CompanyWallet = { companyId: string; companyName: string; totalEarned: number; totalWithdrawn: number; availableBalance: number }
type BankData = { pixKey: string | null; isComplete: boolean }
type DashboardSummary = { walletBalance: number; bankData: BankData }
type Commission = {
  id: string
  clientName: string
  amount: string | null
  commissionValue: string | null
  status: string
  date: string
  company: { id: string; name: string }
  promotion: { id: string; title: string } | null
}
type Withdrawal = {
  id: string
  amount: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  requestDate: string
  proofOfPaymentUrl: string | null
  rejectionReason: string | null
  company: { id: string; name: string }
}

const currency = (value: string | number | null) => (value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "AWAITING_VALUE", label: "Aguardando valor" },
  { value: "PENDING", label: "Aguardando aprovação" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "PAID", label: "Pagas" },
  { value: "REJECTED", label: "Reprovadas" },
]

export default function PartnerCommissionsAndWithdrawalsPage() {
  const [wallets, setWallets] = useState<CompanyWallet[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [withdrawFor, setWithdrawFor] = useState<CompanyWallet | null>(null)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<CompanyWallet[]>("/api/partner/wallet-by-company"),
      adminFetch<DashboardSummary>("/api/partner/dashboard"),
      adminFetch<Withdrawal[]>("/api/partner/withdrawals"),
    ])
      .then(([w, d, wd]) => {
        setWallets(w)
        setDashboard(d)
        setWithdrawals(wd)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const bankData = dashboard?.bankData ?? null
  const totalEarned = wallets.reduce((sum, w) => sum + w.totalEarned, 0)

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Comissões & Saques</h1>
        <p className="text-gray-600 mt-1 text-sm">Sua carteira, faturamento acumulado e solicitações de saque, por empresa.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-5 text-white shadow-lg">
          <Wallet className="w-6 h-6 opacity-80 mb-1" />
          <p className="text-xs opacity-90">Saldo Total na Carteira</p>
          <p className="text-2xl font-bold">{currency(dashboard?.walletBalance ?? 0)}</p>
        </div>
        <AdminCard title="Faturamento Acumulado Ganho" icon={TrendingUp}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(totalEarned)}</p>
        </AdminCard>
        <AdminCard title="Total de Saques Efetuados" icon={Banknote}>
          <p className="text-2xl font-bold text-[#3E2415]">{currency(withdrawals.filter((w) => w.status === "PAID").reduce((s, w) => s + Number(w.amount), 0))}</p>
        </AdminCard>
      </div>

      {bankData && !bankData.isComplete && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">Complete seu CPF e dados de pagamento para solicitar saques.</p>
          </div>
          <Link href="/partner/perfil">
            <Button size="sm" variant="brand">
              Completar Perfil
            </Button>
          </Link>
        </div>
      )}

      <Tabs defaultValue="wallets">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="wallets">Saldo por Empresa</TabsTrigger>
          <TabsTrigger value="commissions">Extrato de Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Histórico de Saques</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="mt-4">
          {wallets.length === 0 ? (
            <EmptyState message="Você ainda não possui histórico de comissões em nenhuma empresa." />
          ) : (
            <div className="grid gap-2">
              {wallets.map((w) => (
                <div key={w.companyId} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-white flex-wrap">
                  <div>
                    <p className="font-semibold text-[#3E2415]">{w.companyName}</p>
                    <p className="text-xs text-gray-500">
                      Ganho: {currency(w.totalEarned)} · Sacado: {currency(w.totalWithdrawn)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-[#3E2415]">{currency(w.availableBalance)}</p>
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={w.availableBalance <= 0}
                      onClick={() => setWithdrawFor(w)}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Solicitar Saque PIX
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          <CommissionsTable />
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          {withdrawals.length === 0 ? (
            <EmptyState message="Nenhum saque solicitado ainda." />
          ) : (
            <>
              <MobileCardList>
                {withdrawals.map((w) => (
                  <MobileCard
                    key={w.id}
                    title={w.company.name}
                    subtitle={new Date(w.requestDate).toLocaleDateString("pt-BR")}
                    badges={<StatusBadge status={w.status} />}
                    fields={[
                      { label: "Valor", value: currency(w.amount) },
                      {
                        label: "Comprovante",
                        value: w.proofOfPaymentUrl ? (
                          <a href={w.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="text-[#F58220] underline">
                            Ver
                          </a>
                        ) : (
                          "—"
                        ),
                      },
                      ...(w.rejectionReason ? [{ label: "Motivo", value: w.rejectionReason }] : []),
                    ]}
                  />
                ))}
              </MobileCardList>
              <TableDesktop>
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
              </TableDesktop>
            </>
          )}
        </TabsContent>
      </Tabs>

      {withdrawFor && (
        <WithdrawDialog
          wallet={withdrawFor}
          onClose={() => setWithdrawFor(null)}
          onDone={() => {
            setWithdrawFor(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function WithdrawDialog({ wallet, onClose, onDone }: { wallet: CompanyWallet; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(wallet.availableBalance))
  const [pixKey, setPixKey] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdesaoGate, setShowAdesaoGate] = useState(false)

  const submit = async () => {
    setError("")
    const amountNumber = Number(amount)
    if (!amountNumber || amountNumber <= 0) {
      setError("Informe um valor válido")
      return
    }
    if (amountNumber > wallet.availableBalance) {
      setError("Valor solicitado é maior que o saldo disponível nesta empresa")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch("/api/partner/withdrawals", {
        method: "POST",
        body: JSON.stringify({ companyId: wallet.companyId, amount: amountNumber, pixKey: pixKey || undefined }),
      })
      onDone()
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 428) {
        setShowAdesaoGate(true)
        return
      }
      setError(e instanceof AdminApiError ? e.message : "Erro ao solicitar saque")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showAdesaoGate) {
    return <AdesaoGateDialog onClose={onClose} onCompleted={submit} />
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar Saque — {wallet.companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-sm text-gray-500">
            Saldo disponível: <strong className="text-[#3E2415]">{currency(wallet.availableBalance)}</strong>
          </p>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" max={wallet.availableBalance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Chave PIX (opcional — usa a cadastrada no perfil se vazio)</Label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" disabled={isSubmitting} onClick={submit}>
            Solicitar Saque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CommissionsTable() {
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
    <div className="space-y-4">
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
        <>
          <MobileCardList>
            {commissions.map((c) => (
              <MobileCard
                key={c.id}
                title={c.clientName}
                subtitle={`${c.company.name}${c.promotion ? ` · ${c.promotion.title}` : ""}`}
                badges={<StatusBadge status={c.status} />}
                fields={[
                  { label: "Data", value: new Date(c.date).toLocaleDateString("pt-BR") },
                  { label: "Valor da conta", value: currency(c.amount) },
                  { label: "Comissão", value: currency(c.commissionValue) },
                ]}
              />
            ))}
          </MobileCardList>

          <TableDesktop>
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
          </TableDesktop>
        </>
      )}
    </div>
  )
}
