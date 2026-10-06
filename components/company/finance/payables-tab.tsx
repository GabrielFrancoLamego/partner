"use client"

import { useEffect, useState } from "react"
import { Banknote, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { ExportReportButton } from "./export-report-button"
import { PayDialog, RecipientDrawer, DueBadge, currencyNum, formatDate, type RecipientBanking } from "./finance-shared"

type PayableRow = {
  id: string
  kind: "WITHDRAWAL" | "OCCURRENCE"
  recipientType: "PARTNER" | "EXTERNAL"
  recipientId: string | null
  label: string
  amount: number
  dueDate: string
  banking: RecipientBanking
}

const TYPE_LABEL = { PARTNER: "Parceiro", EXTERNAL: "Sem cadastro" } as const

/** Contas a Pagar — saques de parceiros aprovados e pagamentos a favorecidos sem cadastro, por ordem de vencimento. */
export function PayablesTab({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<PayableRow[] | null>(null)
  const [selected, setSelected] = useState<PayableRow | null>(null)
  const [paying, setPaying] = useState<PayableRow | null>(null)

  const reload = () => adminFetch<PayableRow[]>("/api/company/finance/payables").then(setRows)
  useEffect(() => {
    reload()
  }, [])

  if (!rows) return <LoadingState />

  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminCard title="Total a pagar" icon={CalendarClock}>
          <p className="text-2xl font-bold text-[#3E2415]">{currencyNum(total)}</p>
          <p className="text-xs text-gray-500 mt-1">{rows.length} compromisso(s) em ordem de vencimento</p>
        </AdminCard>
        <ExportReportButton tab="contas-a-pagar" disabled={rows.length === 0} />
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma conta a pagar. Saques aprovados aparecem aqui." />
      ) : (
        <>
          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Favorecido</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#3E2415]">{r.banking.fullName}</p>
                      <p className="text-xs text-gray-400">{TYPE_LABEL[r.recipientType]}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.label}</td>
                    <td className="px-4 py-3">
                      <span className="mr-2 text-gray-600">{formatDate(r.dueDate)}</span>
                      <DueBadge date={r.dueDate} />
                    </td>
                    <td className="px-4 py-3 font-bold text-[#3E2415]">{currencyNum(r.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPaying(r)
                        }}
                      >
                        <Banknote className="h-4 w-4 mr-1" /> Pagar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDesktop>

          <MobileCardList>
            {rows.map((r) => (
              <div key={`${r.kind}-${r.id}`} onClick={() => setSelected(r)} className="cursor-pointer">
                <MobileCard
                  title={r.banking.fullName}
                  subtitle={r.label}
                  badges={<DueBadge date={r.dueDate} />}
                  fields={[
                    { label: "Vencimento", value: formatDate(r.dueDate) },
                    { label: "Valor", value: currencyNum(r.amount) },
                  ]}
                  actions={
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPaying(r)
                      }}
                    >
                      <Banknote className="h-4 w-4 mr-1" /> Pagar
                    </Button>
                  }
                />
              </div>
            ))}
          </MobileCardList>
        </>
      )}

      {selected && (
        <RecipientDrawer
          banking={selected.banking}
          title={selected.banking.fullName}
          details={[
            { label: "Motivo", value: selected.label },
            { label: "Valor", value: currencyNum(selected.amount) },
            { label: "Vencimento", value: formatDate(selected.dueDate) },
          ]}
          onClose={() => setSelected(null)}
        />
      )}

      {paying && (
        <PayDialog
          title={`Pagar — ${paying.banking.fullName}`}
          description={paying.label}
          amount={paying.amount}
          endpoint="/api/company/finance/settle"
          extraFields={{ kind: paying.kind, id: paying.id }}
          consumoAllowed={false}
          recipient={paying.banking}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            reload()
            onChanged()
          }}
        />
      )}
    </div>
  )
}
