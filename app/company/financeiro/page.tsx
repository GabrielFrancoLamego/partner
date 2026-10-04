"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X, Banknote, Paperclip, ExternalLink, Loader2, Wallet, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageFinance, canManageDailyOperations } from "@/lib/permissions"

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
  // Gerente também acessa (visualiza ocorrências financeiras + quita, ver
  // ReceivablesList) — aprovar Comissão/Saque PIX de Parceiro continua
  // exclusivo do Financeiro/Master (canApproveFinance abaixo).
  const allowed = canManageFinance(user.role) || user.isFinanceResponsible || canManageDailyOperations(user.role)
  const canApproveFinance = canManageFinance(user.role) || user.isFinanceResponsible

  if (!allowed) {
    return <EmptyState message="Acesso restrito ao Master, Gerente e ao Responsável pelo Financeiro." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Financeiro</h1>
        <p className="text-gray-600 mt-1 text-sm">Comissões, saques, recebíveis e quitações de {user.companyName}</p>
      </div>

      <Tabs defaultValue="commissions">
        <TabsList className="w-full justify-start h-auto overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="commissions" className="flex-shrink-0">Comissões & Saques</TabsTrigger>
          <TabsTrigger value="receivables" className="flex-shrink-0">Recebíveis dos Colaboradores</TabsTrigger>
          <TabsTrigger value="payouts" className="flex-shrink-0">Registro de Quitação</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="commissions">
            <Tabs defaultValue="commissions-sub">
              <TabsList>
                <TabsTrigger value="commissions-sub">Comissões</TabsTrigger>
                <TabsTrigger value="withdrawals-sub">Saques PIX</TabsTrigger>
              </TabsList>
              <div className="mt-4">
                <TabsContent value="commissions-sub">
                  <CommissionsList canApprove={canApproveFinance} />
                </TabsContent>
                <TabsContent value="withdrawals-sub">
                  <WithdrawalsList canApprove={canApproveFinance} />
                </TabsContent>
              </div>
            </Tabs>
          </TabsContent>
          <TabsContent value="receivables">
            <ReceivablesList />
          </TabsContent>
          <TabsContent value="payouts">
            <GoalPayoutsPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function CommissionsList({ canApprove }: { canApprove: boolean }) {
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

  const commissionActions = (c: Commission) => (
    <>
      {!canApprove && <span className="text-xs text-gray-400">Só Financeiro/Master</span>}
      {canApprove && (c.status === "PENDING" || c.status === "AWAITING_VALUE") && (
        <>
          <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(c.id, "APPROVED")}>
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleUpdate(c.id, "REJECTED")}>
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
      {canApprove && c.status === "APPROVED" && (
        <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(c.id, "PAID")}>
          <Banknote className="h-4 w-4" />
        </Button>
      )}
    </>
  )

  return (
    <>
      <TableDesktop>
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
                  <div className="flex items-center justify-end gap-1">{commissionActions(c)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableDesktop>

      <MobileCardList>
        {commissions.map((c) => (
          <MobileCard
            key={c.id}
            title={c.partner.name}
            subtitle={c.clientName}
            badges={<StatusBadge status={c.status} />}
            fields={[
              { label: "Data", value: new Date(c.date).toLocaleDateString("pt-BR") },
              { label: "Comissão", value: currency(c.commissionValue) },
              { label: "Promoção", value: c.promotion?.title ?? "—" },
              {
                label: "Comprovante",
                value: c.billAttachmentUrl ? (
                  <a href={c.billAttachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#F58220] hover:underline">
                    Ver <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                ),
              },
            ]}
            actions={commissionActions(c)}
          />
        ))}
      </MobileCardList>
    </>
  )
}

function WithdrawalsList({ canApprove }: { canApprove: boolean }) {
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

  const proofControl = (withdrawal: Withdrawal, isUploading: boolean) => (
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
            accept="image/*,application/pdf"
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
  )

  const withdrawalActions = (withdrawal: Withdrawal) => (
    <>
      {!canApprove && <span className="text-xs text-gray-400">Só Financeiro/Master</span>}
      {canApprove && withdrawal.status === "PENDING" && (
        <>
          <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(withdrawal.id, "APPROVED")}>
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleUpdate(withdrawal.id, "REJECTED")}>
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
      {canApprove && withdrawal.status === "APPROVED" && (
        <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleUpdate(withdrawal.id, "PAID")}>
          <Banknote className="h-4 w-4" />
        </Button>
      )}
    </>
  )

  return (
    <>
      <TableDesktop>
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
                  <td className="px-4 py-3">{proofControl(withdrawal, isUploading)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={withdrawal.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">{withdrawalActions(withdrawal)}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableDesktop>

      <MobileCardList>
        {withdrawals.map((withdrawal) => {
          const isUploading = uploadingId === withdrawal.id
          return (
            <MobileCard
              key={withdrawal.id}
              title={withdrawal.partner.name}
              subtitle={withdrawal.pixKey ?? "—"}
              badges={<StatusBadge status={withdrawal.status} />}
              fields={[
                { label: "Valor", value: currency(withdrawal.amount) },
                { label: "Data", value: new Date(withdrawal.requestDate).toLocaleDateString("pt-BR") },
                { label: "Comprovante", value: proofControl(withdrawal, isUploading) },
              ]}
              actions={withdrawalActions(withdrawal)}
            />
          )
        })}
      </MobileCardList>
    </>
  )
}

type ReceivableOccurrence = {
  id: string
  type: string
  total: number
  status: string
  date: string
  description: string | null
  paymentProofUrl: string | null
  expectedPaymentDate: string | null
}

const RECEIVABLE_TYPE_LABELS: Record<string, string> = {
  SALARIO: "Salário Fixo",
  TAXA_SERVICO: "Taxa de Serviço",
  DIARIA: "Diária",
  COMPRA_DOMINGO: "Compra de Domingo",
  META: "Meta",
  VALE: "Vale/Adiantamento",
  HORA_EXTRA: "Hora Extra",
  CONSUMO: "Consumo",
  CUSTOM: "Lançamento",
}
type ReceivableRow = {
  employeeId: string
  employeeName: string
  pendingAmount: number
  paidAmount: number
  occurrences: ReceivableOccurrence[]
  goalPayouts: { goalName: string; amount: number; status: string; rewardType: string; period: string; paidAt: string; note: string | null }[]
  redemptions: { itemName: string; costXp: number; status: string; createdAt: string }[]
}

function ReceivablesList() {
  const [rows, setRows] = useState<ReceivableRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paying, setPaying] = useState<ReceivableOccurrence | null>(null)
  const [rescheduling, setRescheduling] = useState<ReceivableOccurrence | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ReceivableRow[]>("/api/company/finance/receivables")
      .then(setRows)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  if (isLoading) return <LoadingState />
  if (rows.length === 0) return <EmptyState message="Nenhum colaborador ativo nesta empresa." />

  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.employeeId} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === r.employeeId ? null : r.employeeId)}
            className="w-full flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-[#3E2415] text-sm">{r.employeeName}</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-amber-700">Pendente: {currency(String(r.pendingAmount))}</span>
              <span className="text-green-700">Pago: {currency(String(r.paidAmount))}</span>
            </div>
          </button>
          {expanded === r.employeeId && (
            <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50/50">
              {r.occurrences.length === 0 && r.goalPayouts.length === 0 && r.redemptions.length === 0 ? (
                <p className="text-xs text-gray-400">Sem lançamentos financeiros registrados.</p>
              ) : (
                <>
                  {r.occurrences.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-2 text-xs flex-wrap">
                      <span className="text-gray-600">
                        {RECEIVABLE_TYPE_LABELS[o.type] ?? o.type} {o.description && `— ${o.description}`} · {new Date(o.date).toLocaleDateString("pt-BR")}
                        {o.status === "PENDING" && o.expectedPaymentDate && (
                          <> · previsto {new Date(o.expectedPaymentDate).toLocaleDateString("pt-BR")}</>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {o.paymentProofUrl && (
                          <a href={o.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-[#F58220] underline">
                            Comprovante
                          </a>
                        )}
                        <span className={o.status === "PAID" ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                          {currency(String(o.total))} ({o.status === "PAID" ? "Pago" : "Pendente"})
                        </span>
                        {o.status === "PENDING" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => setRescheduling(o)}>
                              Alterar Data
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => setPaying(o)}>
                              Marcar como Pago
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {r.goalPayouts.map((p, i) => (
                    <div key={`payout-${i}`} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        Meta "{p.goalName}" — {p.period}
                        {p.note && ` — ${p.note}`}
                      </span>
                      <span className="text-green-700 font-medium">{currency(String(p.amount))} (Pago)</span>
                    </div>
                  ))}
                  {r.redemptions.map((rd, i) => (
                    <div key={`red-${i}`} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        Prêmio: {rd.itemName} · {new Date(rd.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-purple-700 font-medium">{rd.costXp} XP ({rd.status === "DELIVERED" ? "Entregue" : "Aprovado"})</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {paying && (
        <MarkOccurrencePaidDialog
          occurrence={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            reload()
          }}
        />
      )}
      {rescheduling && (
        <RescheduleOccurrenceDialog
          occurrence={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function RescheduleOccurrenceDialog({ occurrence, onClose, onDone }: { occurrence: ReceivableOccurrence; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(occurrence.expectedPaymentDate ? occurrence.expectedPaymentDate.slice(0, 10) : "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!date) {
      setError("Informe a nova data prevista")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      await adminFetch(`/api/company/occurrences/${occurrence.id}/mark-paid`, { method: "PATCH", body: JSON.stringify({ expectedPaymentDate: date }) })
      onDone()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao alterar a data")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Data Prevista de Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Nova data prevista</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MarkOccurrencePaidDialog({ occurrence, onClose, onDone }: { occurrence: ReceivableOccurrence; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const body = new FormData()
      if (file) body.append("file", file)
      await adminFetch(`/api/company/occurrences/${occurrence.id}/mark-paid`, { method: "POST", body })
      onDone()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar pagamento")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como Pago — {currency(String(occurrence.total))}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Comprovante de pagamento (opcional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Goal = { id: string; name: string }
type Employee = { id: string; name: string }
type GoalPayout = {
  id: string
  amount: string
  rewardType: "CASH" | "PHYSICAL_REWARD"
  period: string
  paidAt: string
  note: string | null
  goal: { id: string; name: string }
  employee: { id: string; name: string }
  paidBy: { id: string; name: string }
}

function GoalPayoutsPanel() {
  const [payouts, setPayouts] = useState<GoalPayout[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [goalId, setGoalId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [amount, setAmount] = useState("")
  const [rewardType, setRewardType] = useState<"CASH" | "PHYSICAL_REWARD">("CASH")
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = () => {
    setIsLoading(true)
    Promise.all([
      adminFetch<GoalPayout[]>("/api/company/finance/goal-payouts"),
      adminFetch<Goal[]>("/api/company/goals"),
      adminFetch<Employee[]>("/api/company/employees"),
    ])
      .then(([p, g, e]) => {
        setPayouts(p)
        setGoals(g)
        setEmployees(e)
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!goalId || !employeeId) {
      setError("Selecione a meta e o colaborador")
      return
    }
    setIsSubmitting(true)
    try {
      await adminFetch("/api/company/finance/goal-payouts", {
        method: "POST",
        body: JSON.stringify({ goalId, employeeId, amount: Number(amount) || 0, rewardType, period, note }),
      })
      setGoalId("")
      setEmployeeId("")
      setAmount("")
      setNote("")
      reload()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao registrar quitação")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <AdminCard title="Registrar Quitação de Meta" icon={ClipboardCheck}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Meta</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a meta" />
                </SelectTrigger>
                <SelectContent>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="w-full">
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
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={rewardType} onValueChange={(v) => setRewardType(v as "CASH" | "PHYSICAL_REWARD")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Bônus em Dinheiro</SelectItem>
                  <SelectItem value="PHYSICAL_REWARD">Prêmio Físico/Voucher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: pago em dinheiro no caixa" />
          </div>
          <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            <Wallet className="h-4 w-4 mr-1" /> Registrar como Pago
          </Button>
        </form>
      </AdminCard>

      {isLoading ? (
        <LoadingState />
      ) : payouts.length === 0 ? (
        <EmptyState message="Nenhuma quitação registrada ainda." />
      ) : (
        <div className="grid gap-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-[#3E2415] text-sm">
                  {p.employee.name} — {p.goal.name}
                </p>
                <p className="text-xs text-gray-500">
                  {p.period} · registrado por {p.paidBy.name} em {new Date(p.paidAt).toLocaleDateString("pt-BR")}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <span className="text-sm font-semibold text-green-700 flex-shrink-0">
                {p.rewardType === "CASH" ? currency(p.amount) : "Prêmio físico"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
