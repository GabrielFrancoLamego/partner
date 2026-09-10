"use client"

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"

type Transaction = {
  id: string
  type: "COMMISSION" | "WITHDRAWAL" | "MANUAL_CREDIT" | "MANUAL_DEBIT"
  amount: string
  description: string
  status: "COMPLETED" | "PENDING"
  createdAt: string
  company: { id: string; name: string }
  partner: { id: string; name: string; role: string }
  createdBy: { id: string; name: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  COMMISSION: "Comissão",
  WITHDRAWAL: "Saque",
  MANUAL_CREDIT: "Crédito manual",
  MANUAL_DEBIT: "Débito manual",
}

const currency = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function TransactionsTab({ companyId }: { companyId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    adminFetch<Transaction[]>(`/api/admin/finance/transactions?companyId=${companyId}`)
      .then(setTransactions)
      .finally(() => setIsLoading(false))
  }, [companyId])

  if (isLoading) return <LoadingState />
  if (transactions.length === 0) return <EmptyState message="Nenhuma transação registrada ainda." />

  return (
    <>
      <MobileCardList>
        {transactions.map((tx) => {
          const isDebit = tx.type === "MANUAL_DEBIT" || tx.type === "WITHDRAWAL"
          return (
            <MobileCard
              key={tx.id}
              title={tx.description}
              subtitle={`${tx.company.name} · ${tx.partner.name}`}
              badges={
                <span className={`text-sm font-bold ${isDebit ? "text-red-600" : "text-green-600"}`}>
                  {currency(tx.amount)}
                </span>
              }
              fields={[
                { label: "Tipo", value: TYPE_LABELS[tx.type] },
                { label: "Data", value: new Date(tx.createdAt).toLocaleDateString("pt-BR") },
              ]}
            />
          )
        })}
      </MobileCardList>

      <TableDesktop>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Descrição</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Titular</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-[#3E2415]">{tx.description}</td>
              <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[tx.type]}</td>
              <td className="px-4 py-3 text-gray-600">{tx.company.name}</td>
              <td className="px-4 py-3 text-gray-600">{tx.partner.name}</td>
              <td
                className={`px-4 py-3 font-semibold ${
                  tx.type === "MANUAL_DEBIT" || tx.type === "WITHDRAWAL" ? "text-red-600" : "text-green-600"
                }`}
              >
                {currency(tx.amount)}
              </td>
              <td className="px-4 py-3 text-gray-500">{new Date(tx.createdAt).toLocaleDateString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableDesktop>
    </>
  )
}
