"use client"

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"

type Partner = { id: string; name: string; email: string; walletBalance: number; commissionsApproved: number; withdrawalsPending: number; withdrawalsPaid: number }
type Employee = { id: string; name: string; company: { id: string; name: string } | null; pending: number; paid: number; consumptionDebt: number }

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

/** Carteiras para auditoria: parceiros (saldo, comissões, saques) e colaboradores (a receber, recebido, consumo). */
export function WalletsTab({ companyId }: { companyId: string }) {
  const [data, setData] = useState<{ partners: Partner[]; employees: Employee[] } | null>(null)

  useEffect(() => {
    setData(null)
    adminFetch<{ partners: Partner[]; employees: Employee[] }>(`/api/admin/finance/wallets?companyId=${companyId}`).then(setData)
  }, [companyId])

  if (!data) return <LoadingState />

  return (
    <div className="space-y-6">
      <AdminCard title={`Carteiras de Parceiros (${data.partners.length})`}>
        {data.partners.length === 0 ? (
          <EmptyState message="Nenhum parceiro com movimentação." />
        ) : (
          <>
            <TableDesktop>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Parceiro</th>
                    <th className="px-4 py-3 font-medium">Saldo em carteira</th>
                    <th className="px-4 py-3 font-medium">Comissões aprovadas</th>
                    <th className="px-4 py-3 font-medium">Saques pendentes</th>
                    <th className="px-4 py-3 font-medium">Saques pagos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.partners.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#3E2415]">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#3E2415]">{currency(p.walletBalance)}</td>
                      <td className="px-4 py-3 text-gray-600">{currency(p.commissionsApproved)}</td>
                      <td className="px-4 py-3 text-amber-700">{currency(p.withdrawalsPending)}</td>
                      <td className="px-4 py-3 text-green-700">{currency(p.withdrawalsPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableDesktop>
            <MobileCardList>
              {data.partners.map((p) => (
                <MobileCard
                  key={p.id}
                  title={p.name}
                  subtitle={p.email}
                  badges={<span className="text-sm font-bold text-[#3E2415]">{currency(p.walletBalance)}</span>}
                  fields={[
                    { label: "Comissões aprovadas", value: currency(p.commissionsApproved) },
                    { label: "Saques pendentes", value: currency(p.withdrawalsPending) },
                    { label: "Saques pagos", value: currency(p.withdrawalsPaid) },
                  ]}
                />
              ))}
            </MobileCardList>
          </>
        )}
      </AdminCard>

      <AdminCard title={`Carteiras de Colaboradores (${data.employees.length})`}>
        {data.employees.length === 0 ? (
          <EmptyState message="Nenhum colaborador." />
        ) : (
          <>
            <TableDesktop>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Colaborador</th>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium">A receber</th>
                    <th className="px-4 py-3 font-medium">Já recebido</th>
                    <th className="px-4 py-3 font-medium">Conta de Consumo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.employees.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-[#3E2415]">{e.name}</td>
                      <td className="px-4 py-3 text-gray-600">{e.company?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-amber-700">{currency(e.pending)}</td>
                      <td className="px-4 py-3 text-green-700">{currency(e.paid)}</td>
                      <td className="px-4 py-3 text-red-600">{currency(e.consumptionDebt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableDesktop>
            <MobileCardList>
              {data.employees.map((e) => (
                <MobileCard
                  key={e.id}
                  title={e.name}
                  subtitle={e.company?.name ?? "—"}
                  fields={[
                    { label: "A receber", value: currency(e.pending) },
                    { label: "Já recebido", value: currency(e.paid) },
                    { label: "Conta de Consumo", value: currency(e.consumptionDebt) },
                  ]}
                />
              ))}
            </MobileCardList>
          </>
        )}
      </AdminCard>
    </div>
  )
}
