"use client"

import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"

const NEUTRAL_BAND = 1

type EmployeeRow = {
  id: string
  name: string
  evaluation: { id: string; score: string; justification: string | null; evaluatedBy: { name: string } } | null
}

/**
 * Rotina diária de avaliação da equipe — usada tanto em /company/avaliacoes
 * (tela dedicada da Gerente) quanto em /company/fechamento (passo obrigatório
 * do encerramento de expediente), para não duplicar a regra de justificativa.
 */
export function ManagerEvaluationRoutine({
  date,
  onDateChange,
  onSaved,
}: {
  date?: string
  onDateChange?: (date: string) => void
  /** Chamado após cada nota salva — usado por /company/fechamento para reavaliar o passo 2 da sequência obrigatória. */
  onSaved?: () => void
}) {
  const [internalDate, setInternalDate] = useState(date ?? new Date().toISOString().slice(0, 10))
  const activeDate = date ?? internalDate
  const setDate = onDateChange ?? setInternalDate

  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, { score: string; justification: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reload = () => {
    setIsLoading(true)
    adminFetch<EmployeeRow[]>(`/api/company/evaluations?date=${activeDate}`)
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

  useEffect(reload, [activeDate])

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
        body: JSON.stringify({ employeeId, dateRaw: activeDate, score, justification: draft.justification }),
      })
      reload()
      onSaved?.()
    } catch (e) {
      setErrors((prev) => ({ ...prev, [employeeId]: e instanceof AdminApiError ? e.message : "Erro ao salvar" }))
    } finally {
      setSavingId(null)
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <Input type="date" value={activeDate} onChange={(e) => setDate(e.target.value)} className="w-44 bg-white" />

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
