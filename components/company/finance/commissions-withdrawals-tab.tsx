"use client"

import { useEffect, useState } from "react"
import { Check, X, ExternalLink, Calculator, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { StatusBadge, LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { ExportReportButton } from "./export-report-button"
import { currencyNum, formatDate, formatDateTime } from "./finance-shared"
import { addBusinessHours, DEFAULT_WITHDRAWAL_PAYMENT_BUSINESS_HOURS } from "@/lib/business-time"

type Withdrawal = {
  id: string
  amount: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  requestDate: string
  approvedAt: string | null
  expectedPaymentDate: string | null
  pixKey: string | null
  rejectionReason: string | null
  partner: { id: string; name: string; email: string; partnerProfile: { fullName: string | null; cpf: string | null; document: string | null } | null }
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

/** Comissões e Saques — fila de solicitações de saque (aprovar/reprovar) e comissões pendentes de lançamento/aprovação. */
export function CommissionsWithdrawalsTab({ onChanged }: { onChanged: () => void }) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null)
  const [commissions, setCommissions] = useState<Commission[] | null>(null)
  const [rejecting, setRejecting] = useState<Withdrawal | null>(null)
  const [approving, setApproving] = useState<Withdrawal | null>(null)
  const [launching, setLaunching] = useState<Commission | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = () =>
    Promise.all([
      adminFetch<Withdrawal[]>("/api/company/finance/withdrawals").then(setWithdrawals),
      adminFetch<Commission[]>("/api/company/finance/commissions?pending=1").then(setCommissions),
    ])
  useEffect(() => {
    reload()
  }, [])

  const done = () => {
    reload()
    onChanged()
  }

  const updateCommission = async (c: Commission, status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !confirm("Reprovar esta comissão? Ela não será creditada na carteira do parceiro.")) return
    setBusyId(c.id)
    await adminFetch(`/api/company/finance/commissions/${c.id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    setBusyId(null)
    done()
  }

  if (!withdrawals || !commissions) return <LoadingState />

  const queue = withdrawals.filter((w) => w.status === "PENDING")
  const history = withdrawals.filter((w) => w.status !== "PENDING").slice(0, 8)
  const needsValue = (c: Commission) => c.amount === null || c.status === "AWAITING_VALUE"

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <ExportReportButton tab="comissoes-saques" />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#3E2415]">Solicitações de saque de parceiros</h2>
          <p className="text-xs text-gray-500">Aprovar apenas valida o pedido — o pagamento é feito em Contas a Pagar, com comprovante.</p>
        </div>

        {queue.length === 0 ? (
          <EmptyState message="Nenhuma solicitação de saque aguardando análise." />
        ) : (
          <>
            <TableDesktop>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Parceiro</th>
                    <th className="px-4 py-3 font-medium">Chave PIX</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Solicitado em</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queue.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-[#3E2415]">{w.partner.name}</td>
                      <td className="px-4 py-3 text-gray-600">{w.pixKey ?? "—"}</td>
                      <td className="px-4 py-3 font-bold text-[#3E2415]">{currencyNum(Number(w.amount))}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(w.requestDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-green-700 border-green-200" onClick={() => setApproving(w)}>
                            <Check className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => setRejecting(w)}>
                            <X className="h-4 w-4 mr-1" /> Reprovar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableDesktop>
            <MobileCardList>
              {queue.map((w) => (
                <MobileCard
                  key={w.id}
                  title={w.partner.name}
                  subtitle={w.pixKey ?? "Sem chave PIX"}
                  badges={<span className="text-sm font-bold text-[#3E2415]">{currencyNum(Number(w.amount))}</span>}
                  fields={[{ label: "Solicitado em", value: formatDate(w.requestDate) }]}
                  actions={
                    <>
                      <Button size="sm" variant="outline" className="text-green-700 border-green-200" onClick={() => setApproving(w)}>
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => setRejecting(w)}>
                        <X className="h-4 w-4 mr-1" /> Reprovar
                      </Button>
                    </>
                  }
                />
              ))}
            </MobileCardList>
          </>
        )}

        {history.length > 0 && (
          <AdminCard title="Últimas análises">
            <div className="divide-y divide-gray-100">
              {history.map((w) => (
                <div key={w.id} className="py-2 flex items-center justify-between gap-3 flex-wrap text-sm">
                  <span className="text-[#3E2415] font-medium">
                    {w.partner.name} · {currencyNum(Number(w.amount))}
                    {w.status === "REJECTED" && w.rejectionReason && <span className="block text-xs font-normal text-gray-500">Motivo: {w.rejectionReason}</span>}
                    {w.status === "APPROVED" && w.expectedPaymentDate && <span className="block text-xs font-normal text-gray-500">Pagamento previsto: {formatDateTime(w.expectedPaymentDate)}</span>}
                  </span>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          </AdminCard>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#3E2415]">Comissões pendentes de lançamento</h2>
          <p className="text-xs text-gray-500">
            Indicações cujo cliente já esteve na unidade (Scanner PDV) mas ainda falta o valor total da conta para calcular a comissão do parceiro.
          </p>
        </div>

        {commissions.length === 0 ? (
          <EmptyState message="Nenhuma comissão pendente." />
        ) : (
          <>
            <TableDesktop>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Parceiro</th>
                    <th className="px-4 py-3 font-medium">Cliente indicado</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Comanda</th>
                    <th className="px-4 py-3 font-medium">Valor da conta</th>
                    <th className="px-4 py-3 font-medium">Comissão</th>
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
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.date)}</td>
                      <td className="px-4 py-3">
                        {c.billAttachmentUrl ? (
                          <a href={c.billAttachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline">
                            Ver <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">{c.amount !== null ? currencyNum(Number(c.amount)) : <span className="text-amber-700 text-xs">A lançar</span>}</td>
                      <td className="px-4 py-3 font-semibold text-[#3E2415]">{c.commissionValue !== null ? currencyNum(Number(c.commissionValue)) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {needsValue(c) ? (
                            <Button size="sm" variant="outline" onClick={() => setLaunching(c)}>
                              <Calculator className="h-4 w-4 mr-1" /> Lançar valor
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="text-green-700 border-green-200" disabled={busyId === c.id} onClick={() => updateCommission(c, "APPROVED")}>
                                <Check className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200" disabled={busyId === c.id} onClick={() => updateCommission(c, "REJECTED")}>
                                <X className="h-4 w-4 mr-1" /> Reprovar
                              </Button>
                            </>
                          )}
                        </div>
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
                    { label: "Data", value: formatDate(c.date) },
                    { label: "Valor da conta", value: c.amount !== null ? currencyNum(Number(c.amount)) : "A lançar" },
                    { label: "Comissão", value: c.commissionValue !== null ? currencyNum(Number(c.commissionValue)) : "—" },
                  ]}
                  actions={
                    needsValue(c) ? (
                      <Button size="sm" variant="outline" onClick={() => setLaunching(c)}>
                        <Calculator className="h-4 w-4 mr-1" /> Lançar valor
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-200" onClick={() => updateCommission(c, "APPROVED")}>
                          <Check className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => updateCommission(c, "REJECTED")}>
                          <X className="h-4 w-4 mr-1" /> Reprovar
                        </Button>
                      </>
                    )
                  }
                />
              ))}
            </MobileCardList>
          </>
        )}
      </section>

      {approving && <ApproveWithdrawalDialog withdrawal={approving} onClose={() => setApproving(null)} onDone={() => { setApproving(null); done() }} />}
      {rejecting && <RejectWithdrawalDialog withdrawal={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); done() }} />}
      {launching && <LaunchValueDialog commission={launching} onClose={() => setLaunching(null)} onDone={() => { setLaunching(null); done() }} />}
    </div>
  )
}

/** yyyy-MM-ddTHH:mm no fuso local — formato do input datetime-local. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ApproveWithdrawalDialog({ withdrawal, onClose, onDone }: { withdrawal: Withdrawal; onClose: () => void; onDone: () => void }) {
  const [expected, setExpected] = useState(() => toLocalInput(addBusinessHours(new Date(), DEFAULT_WITHDRAWAL_PAYMENT_BUSINESS_HOURS)))
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/finance/withdrawals/${withdrawal.id}`, {
        method: "PATCH",
        // Sem data, o servidor assume 24 horas úteis a partir da aprovação.
        body: JSON.stringify({ status: "APPROVED", expectedPaymentDate: expected ? new Date(expected).toISOString() : undefined }),
      })
      onDone()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao aprovar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar saque — {withdrawal.partner.name}</DialogTitle>
          <DialogDescription>
            {currencyNum(Number(withdrawal.amount))} · PIX {withdrawal.pixKey ?? "não informado"}. Aprovado, o saque vai para Contas a Pagar e o parceiro é avisado da data prevista.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Data/Hora prevista de pagamento</Label>
            <Input type="datetime-local" value={expected} onChange={(e) => setExpected(e.target.value)} />
            <p className="text-[11px] text-gray-400">Sugestão: 24 horas úteis a partir de agora. Se deixar em branco, o sistema usa esse prazo.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Aprovar saque
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RejectWithdrawalDialog({ withdrawal, onClose, onDone }: { withdrawal: Withdrawal; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setError("Informe a justificativa da reprovação")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/finance/withdrawals/${withdrawal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "REJECTED", rejectionReason: reason.trim() }),
      })
      onDone()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao reprovar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprovar saque — {withdrawal.partner.name}</DialogTitle>
          <DialogDescription>
            O valor de {currencyNum(Number(withdrawal.amount))} volta para a carteira do parceiro, que é avisado com a justificativa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Justificativa (obrigatória)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex: dados bancários divergentes do cadastro" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 text-white hover:bg-red-700">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reprovar saque
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LaunchValueDialog({ commission, onClose, onDone }: { commission: Commission; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("")
  const [justification, setJustification] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (amount === "" || Number(amount) < 0) return setError("Informe o valor total da conta")
    if (Number(amount) === 0 && !justification.trim()) return setError("Conta com valor R$ 0,00 exige justificativa")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/finance/commissions/${commission.id}/launch`, {
        method: "PATCH",
        body: JSON.stringify({ amount: Number(amount), billJustification: justification }),
      })
      onDone()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao lançar o valor")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar valor da conta — {commission.clientName}</DialogTitle>
          <DialogDescription>A comissão de {commission.partner.name} é calculada automaticamente pela regra do programa e segue para aprovação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Valor total da conta (R$)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {amount !== "" && Number(amount) === 0 && (
            <div className="space-y-1.5">
              <Label>Justificativa (conta zerada)</Label>
              <Input value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Ex: cliente desistiu antes de consumir" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Gerar comissão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
