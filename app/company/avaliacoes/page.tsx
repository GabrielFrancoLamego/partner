"use client"

import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, AdminCard, MetricRow } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

const NEUTRAL_BAND = 1

export default function CompanyAvaliacoesPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Avaliação Diária</h1>
        <p className="text-gray-600 mt-1 text-sm">
          {isManager ? "Rotina diária de avaliação da equipe" : "Sua nota do dia e seu histórico"}
        </p>
      </div>
      {isManager ? <ManagerEvaluationRoutine /> : <MyEvaluations />}
    </div>
  )
}

type EmployeeRow = {
  id: string
  name: string
  evaluation: { id: string; score: string; justification: string | null; evaluatedBy: { name: string } } | null
}

function ManagerEvaluationRoutine() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, { score: string; justification: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reload = () => {
    setIsLoading(true)
    adminFetch<EmployeeRow[]>(`/api/company/evaluations?date=${date}`)
      .then((data) => {
        setRows(data)
        setDrafts(
          Object.fromEntries(
            data.map((r) => [r.id, { score: r.evaluation?.score ?? "", justification: r.evaluation?.justification ?? "" }]),
          ),
        )
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [date])

  const handleSave = async (employeeId: string) => {
    const draft = drafts[employeeId]
    const score = Number(draft?.score)
    if (draft?.score === "" || Number.isNaN(score)) {
      setErrors((e) => ({ ...e, [employeeId]: "Informe uma nota" }))
      return
    }
    if ((score > NEUTRAL_BAND || score < -NEUTRAL_BAND) && !draft.justification.trim()) {
      setErrors((e) => ({ ...e, [employeeId]: "Justificativa obrigatória para notas fora de -1 a 1" }))
      return
    }
    setErrors((e) => ({ ...e, [employeeId]: "" }))
    setSavingId(employeeId)
    try {
      await adminFetch("/api/company/evaluations", {
        method: "POST",
        body: JSON.stringify({ employeeId, dateRaw: date, score, justification: draft.justification }),
      })
      reload()
    } catch (e) {
      setErrors((prev) => ({ ...prev, [employeeId]: e instanceof AdminApiError ? e.message : "Erro ao salvar" }))
    } finally {
      setSavingId(null)
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 bg-white" />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum colaborador ativo nesta empresa." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const draft = drafts[row.id] ?? { score: "", justification: "" }
            const score = Number(draft.score)
            const needsJustification = draft.score !== "" && !Number.isNaN(score) && (score > NEUTRAL_BAND || score < -NEUTRAL_BAND)
            return (
              <div key={row.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="font-semibold text-[#3E2415] flex-1">{row.name}</p>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Nota"
                    value={draft.score}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...draft, score: e.target.value } }))}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    disabled={savingId === row.id}
                    onClick={() => handleSave(row.id)}
                    className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </div>
                {needsJustification && (
                  <Textarea
                    className="mt-2"
                    placeholder="Justificativa (obrigatória para notas fora de -1 a 1)"
                    value={draft.justification}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...draft, justification: e.target.value } }))}
                  />
                )}
                {errors[row.id] && <p className="text-xs text-red-600 mt-1">{errors[row.id]}</p>}
                {row.evaluation && (
                  <p className="text-xs text-gray-400 mt-2">Avaliado por {row.evaluation.evaluatedBy.name}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type MyEvaluationData = {
  today: { score: string; justification: string | null; evaluatedBy: { name: string } } | null
  fortnightAverage: number
  fortnightCount: number
  monthAverage: number
  monthCount: number
  history: { id: string; date: string; score: string; justification: string | null; evaluatedBy: { name: string } }[]
}

function MyEvaluations() {
  const [data, setData] = useState<MyEvaluationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    adminFetch<MyEvaluationData>("/api/company/evaluations/me")
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminCard title="Nota de hoje">
          {data.today ? (
            <>
              <p className="text-3xl font-bold text-[#3E2415]">{Number(data.today.score).toFixed(1)}</p>
              {data.today.justification && <p className="text-xs text-gray-500 mt-2">{data.today.justification}</p>}
              <p className="text-xs text-gray-400 mt-1">Por {data.today.evaluatedBy.name}</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Ainda não avaliado hoje.</p>
          )}
        </AdminCard>
        <AdminCard title="Média quinzenal">
          <p className="text-3xl font-bold text-[#3E2415]">{data.fortnightAverage.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-1">{data.fortnightCount} avaliações</p>
        </AdminCard>
        <AdminCard title="Média mensal">
          <p className="text-3xl font-bold text-[#3E2415]">{data.monthAverage.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-1">{data.monthCount} avaliações</p>
        </AdminCard>
      </div>

      <AdminCard title="Histórico (30 dias)">
        {data.history.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Nenhuma avaliação registrada ainda.</p>
        ) : (
          <div className="space-y-1">
            {data.history.map((h) => (
              <MetricRow
                key={h.id}
                label={new Date(h.date).toLocaleDateString("pt-BR")}
                value={Number(h.score).toFixed(1)}
              />
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
