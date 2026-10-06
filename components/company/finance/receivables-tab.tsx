"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Banknote, ChevronDown, ChevronUp, PlusCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop } from "@/components/admin/mobile-card"
import { ExportReportButton } from "./export-report-button"
import { PayDialog, RecipientDrawer, DueBadge, currencyNum, formatDate, type RecipientBanking } from "./finance-shared"

type Bucket = { paid: number; pending: number }
type FinanceItem = { kind: "OCCURRENCE" | "GOAL_PAYOUT"; id: string; label: string; amount: number; status: "PENDING" | "PAID"; dueDate: string }

type EmployeeFinance = {
  employeeId: string
  name: string
  employmentType: string | null
  banking: RecipientBanking
  consumptionDebt: number
  month: string
  monthlySalary: number
  projection: {
    adiantamento: Bucket & { dueDate: string | null }
    saldoSalario: Bucket & { dueDate: string | null }
    taxaServico: Bucket
    metas: Bucket
    outrosAdicionais: Bucket
  }
  items: FinanceItem[]
  discountItems: FinanceItem[]
  totals: { pendingEarnings: number; paidEarnings: number; discounts: number; consumo: number; netRemaining: number }
}

const total = (b: Bucket) => b.paid + b.pending

function Cell({ bucket }: { bucket: Bucket }) {
  return (
    <div>
      <p className="font-medium text-[#3E2415]">{currencyNum(total(bucket))}</p>
      {bucket.paid > 0 && <p className="text-[11px] text-green-700">pago {currencyNum(bucket.paid)}</p>}
      {bucket.pending > 0 && bucket.paid > 0 && <p className="text-[11px] text-amber-700">pendente {currencyNum(bucket.pending)}</p>}
    </div>
  )
}

/** Recebíveis de Colaboradores — projeção do mês por colaborador, pagamento individual de itens ou do total líquido. */
export function ReceivablesTab({ onChanged }: { onChanged: () => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<EmployeeFinance[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<EmployeeFinance | null>(null)
  const [payingNet, setPayingNet] = useState<EmployeeFinance | null>(null)
  const [payingItem, setPayingItem] = useState<{ row: EmployeeFinance; item: FinanceItem } | null>(null)
  const [rescheduling, setRescheduling] = useState<FinanceItem | null>(null)

  const reload = () => adminFetch<{ month: string; rows: EmployeeFinance[] }>(`/api/company/finance/receivables?month=${month}`).then((d) => setRows(d.rows))
  useEffect(() => {
    setRows(null)
    reload()
  }, [month])

  const done = () => {
    reload()
    onChanged()
  }

  if (!rows) return <LoadingState />

  const totalNet = rows.reduce((s, r) => s + Math.max(r.totals.netRemaining, 0), 0)
  const exportRows = rows.map((r) => {
    const earliest = r.items.map((i) => i.dueDate).sort()[0]
    return {
      colaborador: r.banking.fullName,
      documento: r.banking.document,
      pix: r.banking.pixKey,
      banco: r.banking.bankName,
      agencia: r.banking.agency,
      conta: r.banking.accountNumber,
      salario: r.monthlySalary,
      adiantamento: total(r.projection.adiantamento),
      taxa: total(r.projection.taxaServico),
      metas: total(r.projection.metas),
      descontos: r.totals.discounts + r.totals.consumo,
      liquido: r.totals.netRemaining,
      vencimento: earliest ? formatDate(earliest) : "—",
      status: r.items.length === 0 ? "Quitado" : "Pendente",
      motivo: `Folha ${r.month}`,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mês de referência</Label>
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
          </div>
          <AdminCard title="Líquido restante da equipe">
            <p className="text-xl font-bold text-[#3E2415]">{currencyNum(totalNet)}</p>
          </AdminCard>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/company/ocorrencias?novo=1">
              <PlusCircle className="h-4 w-4 mr-1.5" /> Lançar Meta/Bônus/Prêmio
            </Link>
          </Button>
          <ExportReportButton
            title={`Recebíveis de Colaboradores — ${month}`}
            filename={`recebiveis-${month}`}
            disabled={rows.length === 0}
            sections={[
              {
                name: "Recebíveis",
                columns: [
                  { header: "Colaborador", key: "colaborador" },
                  { header: "CPF/CNPJ", key: "documento" },
                  { header: "Chave PIX", key: "pix" },
                  { header: "Banco", key: "banco" },
                  { header: "Agência", key: "agencia" },
                  { header: "Conta", key: "conta" },
                  { header: "Salário Fixo", key: "salario", kind: "currency" },
                  { header: "Adiantamento (dia 20)", key: "adiantamento", kind: "currency" },
                  { header: "Taxa de Serviço", key: "taxa", kind: "currency" },
                  { header: "Metas/Premiações", key: "metas", kind: "currency" },
                  { header: "(-) Descontos/Consumo", key: "descontos", kind: "currency" },
                  { header: "Saldo Líquido Restante", key: "liquido", kind: "currency" },
                  { header: "Vencimento", key: "vencimento" },
                  { header: "Status", key: "status" },
                  { header: "Motivo", key: "motivo" },
                ],
                rows: exportRows,
              },
            ]}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Pagamentos de Meta, Bônus ou Prêmio avulso são lançados em <strong>Ocorrências</strong> — a projeção abaixo é recalculada automaticamente.
      </p>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum colaborador ativo nesta empresa." />
      ) : (
        <div className="space-y-2">
          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  <th className="px-4 py-3 font-medium">Salário Fixo</th>
                  <th className="px-4 py-3 font-medium">Adiantamento (dia 20)</th>
                  <th className="px-4 py-3 font-medium">Taxa de Serviço</th>
                  <th className="px-4 py-3 font-medium">Metas/Premiações</th>
                  <th className="px-4 py-3 font-medium">(-) Descontos/Consumo</th>
                  <th className="px-4 py-3 font-medium">Saldo Líquido</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <ReceivableRow
                    key={r.employeeId}
                    row={r}
                    open={expanded === r.employeeId}
                    onToggle={() => setExpanded(expanded === r.employeeId ? null : r.employeeId)}
                    onDrawer={() => setDrawer(r)}
                    onPayNet={() => setPayingNet(r)}
                    onPayItem={(item) => setPayingItem({ row: r, item })}
                    onReschedule={setRescheduling}
                  />
                ))}
              </tbody>
            </table>
          </TableDesktop>

          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.employeeId} className="rounded-xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
                <button className="w-full text-left" onClick={() => setDrawer(r)}>
                  <p className="font-semibold text-[#3E2415]">{r.name}</p>
                  <p className="text-xs text-gray-500">Salário fixo {currencyNum(r.monthlySalary)}</p>
                </button>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[11px] text-gray-400">Adiantamento (dia 20)</p>
                    <p className="font-medium">{currencyNum(total(r.projection.adiantamento))}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Taxa de Serviço</p>
                    <p className="font-medium">{currencyNum(total(r.projection.taxaServico))}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Metas/Premiações</p>
                    <p className="font-medium">{currencyNum(total(r.projection.metas))}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">(-) Descontos/Consumo</p>
                    <p className="font-medium text-red-600">{currencyNum(r.totals.discounts + r.totals.consumo)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-[11px] text-gray-400">Saldo líquido restante</p>
                    <p className="text-lg font-bold text-[#3E2415]">{currencyNum(r.totals.netRemaining)}</p>
                  </div>
                  <Button size="sm" disabled={r.totals.netRemaining <= 0} onClick={() => setPayingNet(r)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                    <Banknote className="h-4 w-4 mr-1" /> Pagar total líquido
                  </Button>
                </div>
                {r.items.length > 0 && (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-500">Itens pendentes</p>
                    {r.items.map((i) => (
                      <div key={`${i.kind}-${i.id}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-600 min-w-0">
                          {i.label} <DueBadge date={i.dueDate} />
                        </span>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setPayingItem({ row: r, item: i })}>
                          {currencyNum(i.amount)} · Pagar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {drawer && (
        <RecipientDrawer
          banking={drawer.banking}
          title={drawer.banking.fullName}
          details={[
            { label: "Líquido restante", value: currencyNum(drawer.totals.netRemaining) },
            { label: "Conta de Consumo", value: currencyNum(drawer.consumptionDebt) },
          ]}
          onClose={() => setDrawer(null)}
        />
      )}

      {payingNet && (
        <PayDialog
          title={`Pagar total líquido — ${payingNet.banking.fullName}`}
          description={`Quita todos os proventos pendentes de ${payingNet.month}, abate vales/descontos e zera o consumo devido.`}
          amount={payingNet.totals.netRemaining}
          endpoint="/api/company/finance/settle-employee"
          extraFields={{ employeeId: payingNet.employeeId, month: payingNet.month }}
          consumoAllowed={false}
          recipient={payingNet.banking}
          onClose={() => setPayingNet(null)}
          onDone={() => {
            setPayingNet(null)
            done()
          }}
        />
      )}

      {payingItem && (
        <PayDialog
          title={`Pagar item — ${payingItem.row.banking.fullName}`}
          description={payingItem.item.label}
          amount={payingItem.item.amount}
          endpoint="/api/company/finance/settle"
          extraFields={{ kind: payingItem.item.kind, id: payingItem.item.id }}
          consumoAllowed
          recipient={payingItem.row.banking}
          onClose={() => setPayingItem(null)}
          onDone={() => {
            setPayingItem(null)
            done()
          }}
        />
      )}

      {rescheduling && (
        <RescheduleDialog
          item={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            done()
          }}
        />
      )}
    </div>
  )
}

function ReceivableRow({
  row,
  open,
  onToggle,
  onDrawer,
  onPayNet,
  onPayItem,
  onReschedule,
}: {
  row: EmployeeFinance
  open: boolean
  onToggle: () => void
  onDrawer: () => void
  onPayNet: () => void
  onPayItem: (item: FinanceItem) => void
  onReschedule: (item: FinanceItem) => void
}) {
  const discountsTotal = row.totals.discounts + row.totals.consumo
  return (
    <>
      <tr className="hover:bg-gray-50 align-top">
        <td className="px-4 py-3">
          <button className="text-left" onClick={onDrawer}>
            <p className="font-semibold text-[#3E2415] hover:underline">{row.name}</p>
            <p className="text-xs text-gray-400">{row.employmentType ?? "—"}</p>
          </button>
        </td>
        <td className="px-4 py-3 text-[#3E2415]">{currencyNum(row.monthlySalary)}</td>
        <td className="px-4 py-3">
          <Cell bucket={row.projection.adiantamento} />
        </td>
        <td className="px-4 py-3">
          <Cell bucket={row.projection.taxaServico} />
        </td>
        <td className="px-4 py-3">
          <Cell bucket={row.projection.metas} />
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-red-600">{currencyNum(discountsTotal)}</p>
          {row.totals.consumo > 0 && <p className="text-[11px] text-gray-500">consumo {currencyNum(row.totals.consumo)}</p>}
        </td>
        <td className="px-4 py-3 font-bold text-[#3E2415]">{currencyNum(row.totals.netRemaining)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={onToggle} disabled={row.items.length === 0 && row.discountItems.length === 0}>
              Itens ({row.items.length}) {open ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
            <Button size="sm" disabled={row.totals.netRemaining <= 0} onClick={onPayNet} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              <Banknote className="h-4 w-4 mr-1" /> Pagar total líquido
            </Button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/60">
          <td colSpan={8} className="px-4 py-3">
            <div className="space-y-2">
              {row.items.map((i) => (
                <div key={`${i.kind}-${i.id}`} className="flex items-center justify-between gap-3 text-xs flex-wrap">
                  <span className="text-gray-600">
                    {i.label} · previsto {formatDate(i.dueDate)} <DueBadge date={i.dueDate} />
                  </span>
                  <span className="flex items-center gap-2">
                    <strong className="text-[#3E2415]">{currencyNum(i.amount)}</strong>
                    {i.kind === "OCCURRENCE" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onReschedule(i)}>
                        Alterar data
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onPayItem(i)}>
                      Pagar
                    </Button>
                  </span>
                </div>
              ))}
              {row.discountItems.map((i) => (
                <div key={`d-${i.id}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-600">(-) {i.label}</span>
                  <strong className="text-red-600">-{currencyNum(i.amount)}</strong>
                </div>
              ))}
              {row.totals.consumo > 0 && (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-600">(-) Conta de Consumo Interno</span>
                  <strong className="text-red-600">-{currencyNum(row.totals.consumo)}</strong>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RescheduleDialog({ item, onClose, onDone }: { item: FinanceItem; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(item.dueDate.slice(0, 10))
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    if (!date) return setError("Informe a nova data prevista")
    setIsSubmitting(true)
    try {
      await adminFetch(`/api/company/occurrences/${item.id}/mark-paid`, { method: "PATCH", body: JSON.stringify({ expectedPaymentDate: date }) })
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
          <p className="text-sm text-gray-600">{item.label}</p>
          <div className="space-y-1.5">
            <Label>Nova data prevista</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
