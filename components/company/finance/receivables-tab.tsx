"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Banknote, ChevronDown, ChevronUp, Loader2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop } from "@/components/admin/mobile-card"
import { ExportReportButton } from "./export-report-button"
import { PayDialog, RecipientDrawer, DueBadge, currencyNum, formatDate, type RecipientBanking } from "./finance-shared"

type Bucket = { paid: number; pending: number }
type Category = "SALARIO" | "ADIANTAMENTO" | "TAXA_SERVICO" | "DIARIA" | "VALE_CONSUMO" | "METAS_BONUS" | "OUTROS" | "DESCONTOS"
type BreakdownItem = {
  kind: "OCCURRENCE" | "GOAL_PAYOUT" | "CONSUMPTION"
  id: string
  category: Category
  label: string
  amount: number
  sign: 1 | -1
  status: "PENDING" | "PAID"
  dueDate: string | null
}

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
  items: { kind: "OCCURRENCE" | "GOAL_PAYOUT"; id: string; label: string; amount: number; dueDate: string }[]
  discountItems: { id: string; label: string; amount: number }[]
  breakdown: BreakdownItem[]
  totals: { pendingEarnings: number; paidEarnings: number; discounts: number; consumo: number; netRemaining: number }
}

const CATEGORY_ORDER: { key: Category; label: string }[] = [
  { key: "SALARIO", label: "Salário Fixo" },
  { key: "ADIANTAMENTO", label: "Adiantamento (dia 20)" },
  { key: "TAXA_SERVICO", label: "Taxa de Serviço" },
  { key: "DIARIA", label: "Diária" },
  { key: "VALE_CONSUMO", label: "Vale/Consumo" },
  { key: "METAS_BONUS", label: "Metas/Bônus de Ocorrência" },
  { key: "OUTROS", label: "Outros adicionais" },
  { key: "DESCONTOS", label: "Descontos" },
]

const total = (b: Bucket) => b.paid + b.pending
const itemKey = (i: BreakdownItem) => `${i.kind}:${i.id}`

function Cell({ bucket }: { bucket: Bucket }) {
  return (
    <div>
      <p className="font-medium text-[#3E2415]">{currencyNum(total(bucket))}</p>
      {bucket.paid > 0 && <p className="text-[11px] text-green-700">pago {currencyNum(bucket.paid)}</p>}
      {bucket.pending > 0 && bucket.paid > 0 && <p className="text-[11px] text-amber-700">pendente {currencyNum(bucket.pending)}</p>}
    </div>
  )
}

type PartialPayment = { row: EmployeeFinance; net: number; selection: { occurrenceIds: string[]; goalPayoutIds: string[]; consumption: boolean } }

/** Recebíveis de Colaboradores — projeção do mês, desdobramento por categoria e pagamento parcial ou do líquido total. */
export function ReceivablesTab({ onChanged }: { onChanged: () => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<EmployeeFinance[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<EmployeeFinance | null>(null)
  const [payingNet, setPayingNet] = useState<EmployeeFinance | null>(null)
  const [payingSelected, setPayingSelected] = useState<PartialPayment | null>(null)
  const [rescheduling, setRescheduling] = useState<BreakdownItem | null>(null)

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
  const panelProps = {
    onPaySelected: setPayingSelected,
    onReschedule: setRescheduling,
  }

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
        <ExportReportButton tab="recebiveis" params={{ month }} disabled={rows.length === 0} />
      </div>
      <p className="text-xs text-gray-500">
        Metas, bônus e premiações não são lançados aqui: registre-os em{" "}
        <Link href="/company/ocorrencias" className="font-medium text-[#F58220] hover:underline">
          Ocorrências
        </Link>{" "}
        e o valor entra automaticamente na projeção abaixo. Abra a linha do colaborador para pagar itens específicos.
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
                {rows.map((r) => {
                  const open = expanded === r.employeeId
                  return (
                    <Fragment key={r.employeeId}>
                      <tr className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3">
                          <button className="text-left" onClick={() => setDrawer(r)}>
                            <p className="font-semibold text-[#3E2415] hover:underline">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.employmentType ?? "—"}</p>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[#3E2415]">{currencyNum(r.monthlySalary)}</td>
                        <td className="px-4 py-3">
                          <Cell bucket={r.projection.adiantamento} />
                        </td>
                        <td className="px-4 py-3">
                          <Cell bucket={r.projection.taxaServico} />
                        </td>
                        <td className="px-4 py-3">
                          <Cell bucket={r.projection.metas} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-red-600">{currencyNum(r.totals.discounts + r.totals.consumo)}</p>
                          {r.totals.consumo > 0 && <p className="text-[11px] text-gray-500">consumo {currencyNum(r.totals.consumo)}</p>}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#3E2415]">{currencyNum(r.totals.netRemaining)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : r.employeeId)}>
                              <ListChecks className="h-4 w-4 mr-1" /> Detalhar {open ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                            </Button>
                            <Button size="sm" disabled={r.totals.netRemaining <= 0} onClick={() => setPayingNet(r)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                              <Banknote className="h-4 w-4 mr-1" /> Pagar total líquido
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={8} className="px-4 py-4">
                            <BreakdownPanel row={r} {...panelProps} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </TableDesktop>

          <div className="md:hidden space-y-3">
            {rows.map((r) => {
              const open = expanded === r.employeeId
              return (
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
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3 gap-2 flex-wrap">
                    <div>
                      <p className="text-[11px] text-gray-400">Saldo líquido restante</p>
                      <p className="text-lg font-bold text-[#3E2415]">{currencyNum(r.totals.netRemaining)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setExpanded(open ? null : r.employeeId)}>
                        Detalhar {open ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                      </Button>
                      <Button size="sm" disabled={r.totals.netRemaining <= 0} onClick={() => setPayingNet(r)} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                        <Banknote className="h-4 w-4 mr-1" /> Pagar total
                      </Button>
                    </div>
                  </div>
                  {open && <BreakdownPanel row={r} {...panelProps} />}
                </div>
              )
            })}
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

      {payingSelected && (
        <PayDialog
          title={`Pagar itens selecionados — ${payingSelected.row.banking.fullName}`}
          description="Quitação parcial: só os itens marcados são pagos; o restante segue pendente."
          amount={payingSelected.net}
          endpoint="/api/company/finance/settle-employee"
          extraFields={{ employeeId: payingSelected.row.employeeId, month: payingSelected.row.month, selection: JSON.stringify(payingSelected.selection) }}
          consumoAllowed={false}
          recipient={payingSelected.row.banking}
          onClose={() => setPayingSelected(null)}
          onDone={() => {
            setPayingSelected(null)
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

/** Desdobramento da linha: cada provento e desconto por categoria, com checkboxes para pagar só o que for marcado. */
function BreakdownPanel({
  row,
  onPaySelected,
  onReschedule,
}: {
  row: EmployeeFinance
  onPaySelected: (p: PartialPayment) => void
  onReschedule: (item: BreakdownItem) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (item: BreakdownItem, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(itemKey(item))
      else next.delete(itemKey(item))
      return next
    })

  const pickedItems = row.breakdown.filter((i) => selected.has(itemKey(i)))
  const selection = useMemo(
    () => ({
      occurrenceIds: pickedItems.filter((i) => i.kind === "OCCURRENCE").map((i) => i.id),
      goalPayoutIds: pickedItems.filter((i) => i.kind === "GOAL_PAYOUT").map((i) => i.id),
      consumption: pickedItems.some((i) => i.kind === "CONSUMPTION"),
    }),
    [pickedItems.length, row],
  )
  const earnings = pickedItems.filter((i) => i.sign === 1).reduce((s, i) => s + i.amount, 0)
  const deductions = pickedItems.filter((i) => i.sign === -1).reduce((s, i) => s + i.amount, 0)
  const net = Math.round((earnings - deductions) * 100) / 100
  const canPay = pickedItems.some((i) => i.sign === 1) && net > 0

  const groups = CATEGORY_ORDER.map((c) => ({ ...c, items: row.breakdown.filter((i) => i.category === c.key) })).filter((g) => g.items.length > 0)
  const selectablePending = row.breakdown.filter((i) => i.status === "PENDING")

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-xs text-gray-400">Sem lançamentos financeiros neste mês.</p>
      ) : (
        groups.map((g) => {
          const pending = g.items.filter((i) => i.status === "PENDING").reduce((s, i) => s + i.sign * i.amount, 0)
          const sum = g.items.reduce((s, i) => s + i.sign * i.amount, 0)
          return (
            <div key={g.key} className="rounded-lg border border-gray-100 bg-white">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-sm">
                <span className="font-medium text-[#3E2415]">{g.label}</span>
                <span className="text-xs text-gray-500">
                  total {currencyNum(sum)} · pendente <strong className={pending < 0 ? "text-red-600" : "text-[#3E2415]"}>{currencyNum(pending)}</strong>
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {g.items.map((i) => (
                  <label key={itemKey(i)} className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer">
                    <Checkbox checked={selected.has(itemKey(i))} disabled={i.status === "PAID"} onCheckedChange={(v) => toggle(i, v === true)} />
                    <span className="flex-1 min-w-0 text-gray-600">
                      {i.label}
                      {i.dueDate && (
                        <span className="ml-2 text-gray-400">
                          previsto {formatDate(i.dueDate)} {i.status === "PENDING" && <DueBadge date={i.dueDate} />}
                        </span>
                      )}
                    </span>
                    {i.status === "PAID" && <span className="text-green-700 font-medium">Pago</span>}
                    {i.status === "PENDING" && i.kind === "OCCURRENCE" && i.sign === 1 && (
                      <button
                        type="button"
                        className="text-[11px] text-[#F58220] hover:underline"
                        onClick={(e) => {
                          e.preventDefault()
                          onReschedule(i)
                        }}
                      >
                        Alterar data
                      </button>
                    )}
                    <strong className={i.sign === -1 ? "text-red-600" : "text-[#3E2415]"}>
                      {i.sign === -1 ? "-" : ""}
                      {currencyNum(i.amount)}
                    </strong>
                  </label>
                ))}
              </div>
            </div>
          )
        })
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white border border-gray-100 px-3 py-2.5">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setSelected(new Set(selectablePending.map(itemKey)))}
            disabled={selectablePending.length === 0}
          >
            Marcar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            Limpar
          </Button>
          <span>
            {selected.size} item(ns) · líquido selecionado <strong className="text-[#3E2415]">{currencyNum(Math.max(net, 0))}</strong>
          </span>
        </div>
        <Button
          size="sm"
          disabled={!canPay}
          onClick={() => onPaySelected({ row, net, selection })}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
        >
          <Banknote className="h-4 w-4 mr-1" /> Pagar Itens Selecionados
        </Button>
      </div>
      {selected.size > 0 && !canPay && <p className="text-xs text-amber-700">Marque ao menos um provento e confira se os descontos marcados não superam o valor a pagar.</p>}
    </div>
  )
}

function RescheduleDialog({ item, onClose, onDone }: { item: BreakdownItem; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(item.dueDate ? item.dueDate.slice(0, 10) : "")
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
