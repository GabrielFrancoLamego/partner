"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Trophy, AlertTriangle, ListChecks, TrendingUp, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type BankExtractRow = { date: string; deltaMinutes: number; label: string; source: "TIMECLOCK" | "OCCURRENCE" }
type XpEntryRow = { id: string; points: number; reason: string; note: string | null; createdAt: string }
type OccurrenceRow = { id: string; type: string; date: string; quantity: string; description: string | null; customType: { name: string } | null }
type ChecklistRow = { id: string; title: string; status: string; dueAt: string | null; priority: string }
type EmployeeDetail = {
  id: string
  name: string
  email: string
  phone: string | null
  consumptionDebt: number
  sector: { id: string; name: string } | null
  bankOfHoursMinutes: number
  xpPoints: number
  workStartTime: string | null
  workEndTime: string | null
  weeklyDayOff: number | null
  bankExtract: BankExtractRow[]
  xpEntries: XpEntryRow[]
  occurrences: OccurrenceRow[]
  todayChecklists: ChecklistRow[]
  efficiency: { avgScore: number | null; checklistTotal: number; checklistApproved: number; checklistRate: number | null }
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const OCCURRENCE_TYPE_LABELS: Record<string, string> = {
  FOLGA_FERIADO: "Folga/Feriado",
  VALE: "Vale/Adiantamento",
  CONSUMO: "Consumo (Conta/Comanda)",
  QUEBRA_CAIXA: "Quebra de Caixa",
  PAGAMENTO_CONSUMO: "Pagamento de Consumo",
  META: "Bonificação de meta",
  FALTA: "Falta",
  ATESTADO: "Atestado",
  ADVERTENCIA: "Advertência",
  SUSPENSAO: "Suspensão",
  DIARIA: "Diária (temporário)",
  HORA_EXTRA: "Hora extra",
  BANCO_HORAS: "Banco de horas",
  DISPENSADO: "Desligamento",
  FIXADO: "Efetivação",
  CUSTOM: "Personalizado",
}

function formatBank(minutes: number) {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${String(m).padStart(2, "0")}`
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = useCompanyUser()
  const [data, setData] = useState<EmployeeDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const isManager = canManageDailyOperations(user.role)

  useEffect(() => {
    if (!isManager) return
    adminFetch<EmployeeDetail>(`/api/company/employees/${params.id}`)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, isManager])

  if (!isManager) {
    return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />
  }
  if (isLoading) return <LoadingState />
  if (notFound || !data) return <EmptyState message="Colaborador não encontrado." />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/company/colaboradores")} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">{data.name}</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {data.sector?.name ?? "Sem setor"}
            {data.workStartTime && data.workEndTime && ` · ${data.workStartTime} – ${data.workEndTime}`}
            {data.weeklyDayOff !== null && ` · Folga: ${WEEKDAY_SHORT[data.weeklyDayOff]}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/company/colaboradores")}>
          <Pencil className="h-4 w-4 mr-1.5" /> Editar Setor/Horário
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <p className="text-xs text-gray-500">Banco de Horas</p>
          <p className={`text-2xl font-bold ${data.bankOfHoursMinutes < 0 ? "text-red-600" : data.bankOfHoursMinutes > 0 ? "text-green-600" : "text-[#3E2415]"}`}>
            {formatBank(data.bankOfHoursMinutes)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <p className="text-xs text-gray-500">Pontos (Programa Interno)</p>
          <p className="text-2xl font-bold text-[#3E2415]">{data.xpPoints} Pts</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <p className="text-xs text-gray-500">Conta de Consumo</p>
          <p className={`text-2xl font-bold ${data.consumptionDebt > 0 ? "text-amber-600" : "text-[#3E2415]"}`}>
            {data.consumptionDebt.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>

      <AdminCard title="Eficiência" icon={TrendingUp}>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <p className="text-gray-600">
            Nota diária média (mês): <strong className="text-[#3E2415]">{data.efficiency.avgScore !== null ? data.efficiency.avgScore.toFixed(1) : "— sem avaliações"}</strong>
          </p>
          <p className="text-gray-600">
            Checklist aprovado no mês:{" "}
            <strong className="text-[#3E2415]">
              {data.efficiency.checklistRate !== null ? `${data.efficiency.checklistRate}% (${data.efficiency.checklistApproved}/${data.efficiency.checklistTotal})` : "— sem tarefas"}
            </strong>
          </p>
        </div>
      </AdminCard>

      <AdminCard title="Checklist de Hoje" icon={ListChecks}>
        {data.todayChecklists.length === 0 ? (
          <EmptyState message="Nenhuma tarefa de checklist para hoje." />
        ) : (
          <div className="space-y-2">
            {data.todayChecklists.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <p className="text-sm text-[#3E2415]">{c.title}</p>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Extrato do Banco de Horas" icon={Clock}>
        {data.bankExtract.length === 0 ? (
          <EmptyState message="Nenhuma movimentação registrada ainda." />
        ) : (
          <div className="space-y-2">
            {data.bankExtract.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm text-[#3E2415]">{row.label}</p>
                  <p className="text-xs text-gray-400">{new Date(row.date).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-sm font-semibold ${row.deltaMinutes < 0 ? "text-red-600" : "text-green-600"}`}>{formatBank(row.deltaMinutes)}</span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Pontos — Extrato" icon={Trophy}>
        {data.xpEntries.length === 0 ? (
          <EmptyState message="Nenhuma movimentação de pontos ainda." />
        ) : (
          <div className="space-y-2">
            {data.xpEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm text-[#3E2415]">{e.note ?? e.reason}</p>
                  <p className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-sm font-semibold ${e.points < 0 ? "text-red-600" : "text-green-600"}`}>
                  {e.points > 0 ? "+" : ""}
                  {e.points} Pts
                </span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard title="Ocorrências" icon={AlertTriangle}>
        {data.occurrences.length === 0 ? (
          <EmptyState message="Nenhuma ocorrência registrada ainda." />
        ) : (
          <div className="space-y-2">
            {data.occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm text-[#3E2415]">{o.type === "CUSTOM" ? o.customType?.name ?? "Personalizado" : OCCURRENCE_TYPE_LABELS[o.type] ?? o.type}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(o.date).toLocaleDateString("pt-BR")}
                    {o.description && ` · ${o.description}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
