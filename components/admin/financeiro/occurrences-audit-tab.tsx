"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"

type Row = {
  id: string
  company: { id: string; name: string }
  employeeName: string
  typeLabel: string
  description: string | null
  total: number
  date: string
  expectedPaymentDate: string | null
  paymentStatus: "PENDING" | "PAID"
  paymentMethod: string | null
  paidAt: string | null
  paidBy: { id: string; name: string } | null
  paymentProofUrl: string | null
}

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const METHOD_LABEL: Record<string, string> = { PIX: "Pix", DINHEIRO: "Dinheiro", TRANSFERENCIA: "Transferência", CONSUMO: "Consumo Interno", TRABALHO: "Trabalho", FOLGA_ADICIONAL: "Folga adicional" }
const dateTime = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—")

/** Auditoria de ocorrências financeiras de qualquer empresa/colaborador — pendentes ou pagas, com quem quitou e o comprovante. */
export function OccurrencesAuditTab({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")

  useEffect(() => {
    setRows(null)
    const handle = setTimeout(() => {
      const qs = new URLSearchParams({ companyId, status })
      if (q.trim()) qs.set("q", q.trim())
      adminFetch<Row[]>(`/api/admin/finance/occurrences?${qs.toString()}`).then(setRows)
    }, 250)
    return () => clearTimeout(handle)
  }, [companyId, status, q])

  const proof = (r: Row) =>
    r.paymentProofUrl ? (
      <a href={r.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#F58220] hover:underline">
        Comprovante <ExternalLink className="h-3 w-3" />
      </a>
    ) : (
      "—"
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar colaborador..." className="sm:w-64 min-h-11 md:min-h-0" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48 min-h-11 md:min-h-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="PENDING">Pendentes de pagamento</SelectItem>
            <SelectItem value="PAID">Pagas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!rows ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma ocorrência financeira encontrada." />
      ) : (
        <>
          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-gray-600">{r.company.name}</td>
                    <td className="px-4 py-3 font-semibold text-[#3E2415]">{r.employeeName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.typeLabel}
                      {r.description && <span className="block text-xs text-gray-400">{r.description}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(r.date).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 font-medium text-[#3E2415]">{currency(r.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.paymentStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 space-y-0.5">
                      {r.paymentStatus === "PAID" ? (
                        <>
                          <p>
                            {r.paymentMethod ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) : "—"} · {dateTime(r.paidAt)}
                          </p>
                          <p>por {r.paidBy?.name ?? "—"}</p>
                          {proof(r)}
                        </>
                      ) : (
                        <p>Previsto {r.expectedPaymentDate ? new Date(r.expectedPaymentDate).toLocaleDateString("pt-BR") : "—"}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDesktop>
          <MobileCardList>
            {rows.map((r) => (
              <MobileCard
                key={r.id}
                title={r.employeeName}
                subtitle={`${r.company.name} · ${r.typeLabel}`}
                badges={<StatusBadge status={r.paymentStatus} />}
                fields={[
                  { label: "Valor", value: currency(r.total) },
                  { label: "Data", value: new Date(r.date).toLocaleDateString("pt-BR") },
                  { label: "Pagamento", value: r.paymentStatus === "PAID" ? `${r.paymentMethod ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) : "—"} · ${r.paidBy?.name ?? "—"}` : "Pendente" },
                  { label: "Comprovante", value: proof(r) },
                ]}
              />
            ))}
          </MobileCardList>
        </>
      )}
    </div>
  )
}
