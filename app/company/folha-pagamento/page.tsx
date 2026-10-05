"use client"

import { useEffect, useState } from "react"
import { FileSpreadsheet, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

type PayrollRow = {
  employeeId: string
  name: string
  bankName: string | null
  accountType: string | null
  agency: string | null
  accountNumber: string | null
  pixKey: string | null
  document: string | null
  dueDate: string
  status: "PENDING" | "PAID"
  proventos: Record<string, number>
  descontos: Record<string, number>
  netAmount: number
}
type PayrollData = { phase: "ADVANCE" | "BALANCE"; month: string; dueDate: string; rows: PayrollRow[] }

const PROVENTO_LABELS: Record<string, string> = {
  adiantamento: "Adiantamento (40%)",
  saldoSalario: "Saldo do Salário (60%)",
  taxaServico: "Taxa de Serviço",
  metas: "Bônus de Metas",
  comprasDomingo: "Domingos Trabalhados",
  bonusEspecial: "Bônus Especial",
}
const DESCONTO_LABELS: Record<string, string> = {
  consumoInterno: "Consumo Interno",
  vales: "Vales/Adiantamentos",
  descontoEspecial: "Desconto Especial",
}

function monthNow() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function CompanyFolhaPagamentoPage() {
  const user = useCompanyUser()
  const allowed = canManageDailyOperations(user.role)
  const [phase, setPhase] = useState<"ADVANCE" | "BALANCE">("ADVANCE")
  const [month, setMonth] = useState(monthNow())
  const [data, setData] = useState<PayrollData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!allowed) return
    setIsLoading(true)
    adminFetch<PayrollData>(`/api/company/payroll?phase=${phase}&month=${month}`)
      .then(setData)
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, month, allowed])

  if (!allowed) return <EmptyState message="Acesso restrito ao Master e à Gerente." />

  const totalNet = data?.rows.reduce((sum, r) => sum + r.netAmount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Folha de Pagamento</h1>
          <p className="text-gray-600 mt-1 text-sm">{user.companyName} — colaboradores Fixos e Temporários</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 bg-white" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={phase === "ADVANCE" ? "default" : "outline"} onClick={() => setPhase("ADVANCE")} className={phase === "ADVANCE" ? "bg-[#3E2415] text-white" : ""}>
          Adiantamento (Dia 20)
        </Button>
        <Button variant={phase === "BALANCE" ? "default" : "outline"} onClick={() => setPhase("BALANCE")} className={phase === "BALANCE" ? "bg-[#3E2415] text-white" : ""}>
          Folha Principal (5º Dia Útil)
        </Button>
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : data.rows.length === 0 ? (
        <EmptyState message="Nenhum colaborador Fixo/Temporário com salário cadastrado." />
      ) : (
        <>
          <AdminCard title="Total líquido da folha" icon={FileSpreadsheet}>
            <p className="text-2xl font-bold text-[#3E2415]">{currency(totalNet)}</p>
            <p className="text-xs text-gray-500 mt-1">Vencimento: {new Date(data.dueDate).toLocaleDateString("pt-BR")} · {data.rows.length} colaborador(es)</p>
          </AdminCard>

          <MobileCardList>
            {data.rows.map((r) => (
              <MobileCard
                key={r.employeeId}
                title={r.name}
                subtitle={r.document ?? "Sem CPF cadastrado"}
                badges={<span className="text-sm font-bold text-[#3E2415]">{currency(r.netAmount)}</span>}
                fields={[
                  ...Object.entries(r.proventos).filter(([, v]) => v > 0).map(([k, v]) => ({ label: PROVENTO_LABELS[k] ?? k, value: `+${currency(v)}` })),
                  ...Object.entries(r.descontos).filter(([, v]) => v > 0).map(([k, v]) => ({ label: DESCONTO_LABELS[k] ?? k, value: `-${currency(v)}` })),
                  { label: "Banco", value: r.bankName ?? "—" },
                  { label: "Agência/Conta", value: r.agency && r.accountNumber ? `${r.agency} / ${r.accountNumber}` : "—" },
                  { label: "Chave PIX", value: r.pixKey ?? "—" },
                ]}
              />
            ))}
          </MobileCardList>

          <TableDesktop>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  <th className="px-4 py-3 font-medium">Proventos</th>
                  <th className="px-4 py-3 font-medium">Descontos</th>
                  <th className="px-4 py-3 font-medium">Líquido</th>
                  <th className="px-4 py-3 font-medium">Banco</th>
                  <th className="px-4 py-3 font-medium">Agência/Conta</th>
                  <th className="px-4 py-3 font-medium">PIX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 font-semibold text-[#3E2415]">
                      {r.name}
                      <p className="text-xs text-gray-400 font-normal">{r.document ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-green-700 text-xs">
                      {Object.entries(r.proventos)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <p key={k}>
                            {PROVENTO_LABELS[k] ?? k}: {currency(v)}
                          </p>
                        ))}
                    </td>
                    <td className="px-4 py-3 text-red-600 text-xs">
                      {Object.entries(r.descontos)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <p key={k}>
                            {DESCONTO_LABELS[k] ?? k}: -{currency(v)}
                          </p>
                        ))}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#3E2415]">{currency(r.netAmount)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.bankName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.agency && r.accountNumber ? `${r.agency} / ${r.accountNumber}` : "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.pixKey ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableDesktop>
        </>
      )}
    </div>
  )
}
