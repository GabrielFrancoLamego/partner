"use client"

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, AdminCard, MetricRow } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"
import { ManagerEvaluationRoutine } from "@/components/company/manager-evaluation-routine"

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
