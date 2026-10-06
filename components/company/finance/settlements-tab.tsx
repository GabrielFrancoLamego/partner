"use client"

import { useEffect, useState } from "react"
import { Receipt } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { ExportReportButton } from "./export-report-button"
import { ProofViewer, currencyNum, formatDate, formatDateTime, PAYMENT_METHOD_LABELS, type PaymentMethod } from "./finance-shared"

type Settlement = {
  id: string
  sourceKind: "WITHDRAWAL" | "OCCURRENCE" | "GOAL_PAYOUT" | "EMPLOYEE_NET"
  recipientType: "PARTNER" | "EMPLOYEE" | "EXTERNAL"
  recipientName: string
  recipientDocument: string | null
  pixKey: string | null
  description: string
  amount: number
  dueDate: string | null
  paymentMethod: PaymentMethod
  proofUrl: string
  paidAt: string
  paidBy: { id: string; name: string }
  omieCodigoLancamento: string | null
  omieStatus: string | null
}

const KIND_LABEL = {
  WITHDRAWAL: "Saque de parceiro",
  OCCURRENCE: "Ocorrência",
  GOAL_PAYOUT: "Bônus de meta",
  EMPLOYEE_NET: "Líquido do colaborador",
} as const
const RECIPIENT_LABEL = { PARTNER: "Parceiro", EMPLOYEE: "Colaborador", EXTERNAL: "Sem cadastro" } as const

const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const defaultFrom = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toDateInput(d)
}

/** Registro de Quitação — extrato de tudo que foi pago (Contas a Pagar e Recebíveis), com comprovante. */
export function SettlementsTab() {
  const [rows, setRows] = useState<Settlement[] | null>(null)
  // Padrão: últimos 30 dias (data inicial = hoje − 30, data final = hoje); tabela e exportações seguem o intervalo.
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(() => toDateInput(new Date()))
  const [selected, setSelected] = useState<Settlement | null>(null)

  useEffect(() => {
    setRows(null)
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    adminFetch<Settlement[]>(`/api/company/finance/settlements?${qs.toString()}`).then(setRows)
  }, [from, to])

  const totalPaid = (rows ?? []).reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <AdminCard title="Total quitado no período" icon={Receipt}>
            <p className="text-xl font-bold text-[#3E2415]">{currencyNum(totalPaid)}</p>
          </AdminCard>
        </div>
        <ExportReportButton tab="quitacoes" params={{ from, to }} disabled={!rows || rows.length === 0} />
      </div>

      {!rows ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma quitação registrada no período. Tudo que for pago aparece aqui." />
      ) : (
        <>
          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Pago em</th>
                  <th className="px-4 py-3 font-medium">Favorecido</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Forma</th>
                  <th className="px-4 py-3 font-medium">Pago por</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(r.paidAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#3E2415]">{r.recipientName}</p>
                      <p className="text-xs text-gray-400">{RECIPIENT_LABEL[r.recipientType]}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.description}</td>
                    <td className="px-4 py-3 text-gray-600">{PAYMENT_METHOD_LABELS[r.paymentMethod]}</td>
                    <td className="px-4 py-3 text-gray-600">{r.paidBy.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{currencyNum(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDesktop>
          <MobileCardList>
            {rows.map((r) => (
              <div key={r.id} onClick={() => setSelected(r)} className="cursor-pointer">
                <MobileCard
                  title={r.recipientName}
                  subtitle={r.description}
                  badges={<span className="text-sm font-bold text-green-700">{currencyNum(r.amount)}</span>}
                  fields={[
                    { label: "Pago em", value: formatDateTime(r.paidAt) },
                    { label: "Forma", value: PAYMENT_METHOD_LABELS[r.paymentMethod] },
                    { label: "Pago por", value: r.paidBy.name },
                  ]}
                />
              </div>
            ))}
          </MobileCardList>
        </>
      )}

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quitação — {selected.recipientName}</DialogTitle>
              <DialogDescription>
                {KIND_LABEL[selected.sourceKind]} · {RECIPIENT_LABEL[selected.recipientType]}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl bg-gray-50 p-3 text-sm space-y-1.5">
              {[
                ["Valor pago", currencyNum(selected.amount)],
                ["Pago por", selected.paidBy.name],
                ["Data/hora da quitação", formatDateTime(selected.paidAt)],
                ["Forma de pagamento", PAYMENT_METHOD_LABELS[selected.paymentMethod]],
                ["Vencimento", formatDate(selected.dueDate)],
                ["CPF/CNPJ", selected.recipientDocument ?? "—"],
                ["Chave PIX", selected.pixKey ?? "—"],
                ["Motivo/origem", selected.description],
                ["Omie", selected.omieStatus ?? "Não sincronizado"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-[#3E2415] text-right break-words">{value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[#3E2415]">Comprovante</p>
              <ProofViewer url={selected.proofUrl} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
