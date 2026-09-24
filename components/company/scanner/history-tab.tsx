"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"

type HistoryItem = {
  id: string
  kind: "PROMOTION" | "VALE_RETORNO"
  promotionTitle: string
  clientName: string
  referredBy: string
  amount: string | null
  attachmentUrl: string | null
  date: string
}

const currency = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))

/** Histórico de todos os Vouchers/Promoções resgatados no Scanner PDV, por período. */
export function HistoryTab() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<HistoryItem[]>(`/api/company/scanner/history?from=${from}&to=${to}`)
      .then(setItems)
      .finally(() => setIsLoading(false))
  }, [from, to])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1.5">
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="Nenhum resgate no período." />
      ) : (
        <>
          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Promoção</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Comprovante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(i.date).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-medium text-[#3E2415]">{i.promotionTitle}</td>
                    <td className="px-4 py-3 text-gray-600">{i.clientName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {i.referredBy} {i.kind === "VALE_RETORNO" && <span className="text-xs text-[#F58220]">(Vale Retorno)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{currency(i.amount)}</td>
                    <td className="px-4 py-3">
                      {i.attachmentUrl ? (
                        <a href={i.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline">
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDesktop>

          <MobileCardList>
            {items.map((i) => (
              <MobileCard
                key={i.id}
                title={i.promotionTitle}
                subtitle={`${i.clientName} · ${new Date(i.date).toLocaleDateString("pt-BR")}`}
                fields={[
                  { label: "Origem", value: i.kind === "VALE_RETORNO" ? `${i.referredBy} (Vale Retorno)` : i.referredBy },
                  { label: "Valor", value: currency(i.amount) },
                ]}
                actions={
                  i.attachmentUrl ? (
                    <a href={i.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] underline">
                      Ver comprovante
                    </a>
                  ) : undefined
                }
              />
            ))}
          </MobileCardList>
        </>
      )}
    </div>
  )
}
