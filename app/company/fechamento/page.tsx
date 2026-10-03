"use client"

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react"
import { Clock, Camera, CheckCircle2, AlertTriangle, ExternalLink, Lock, ReceiptText, History, ChevronLeft, Check, X, Save, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, AdminCard, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations, isCompanyMasterOrAdmin } from "@/lib/permissions"

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

type PendingCommission = { id: string; clientName: string; commissionValue: string | null; partner: { name: string } }
type PendingEmployee = { id: string; name: string }
type PendingTimeclockAdjustment = {
  employeeId: string
  employeeName: string
  kind: "LATE_CHECKIN" | "CHECKOUT_VARIANCE" | "BREAK_OVERAGE"
  computedMinutes: number
  computedPoints: number
  isNegativeForEmployee: boolean
  label: string
}

type ShiftClosingStatus = {
  date: string
  deadline: string
  overdue: boolean
  canOverride: boolean
  closing: {
    id: string
    status: string
    revenueAmount: string | null
    receiptUrl: string | null
    summary: string | null
    isMasterOverride: boolean
    isLate: boolean
    closedBy: { name: string } | null
    closedAt: string | null
  } | null
  checklist: {
    pendingTimeclockAdjustments: PendingTimeclockAdjustment[]
    pendingCommissions: PendingCommission[]
    pendingEmployees: PendingEmployee[]
    step0Complete: boolean
    step1Complete: boolean
    step2Complete: boolean
  }
}

function useCountdown(deadline: string | undefined) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return useMemo(() => {
    if (!deadline) return null
    const [h, m] = deadline.split(":").map(Number)
    const cutoff = new Date(now)
    cutoff.setHours(h, m, 0, 0)
    const diffMs = cutoff.getTime() - now.getTime()
    const overdue = diffMs < 0
    const abs = Math.abs(diffMs)
    const hh = String(Math.floor(abs / 3600000)).padStart(2, "0")
    const mm = String(Math.floor((abs % 3600000) / 60000)).padStart(2, "0")
    const ss = String(Math.floor((abs % 60000) / 1000)).padStart(2, "0")
    return { overdue, label: `${hh}:${mm}:${ss}` }
  }, [deadline, now])
}

function StepBadge({ done, number }: { done: boolean; number: number }) {
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
      }`}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : number}
    </span>
  )
}

export default function CompanyFechamentoPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)
  const isMaster = isCompanyMasterOrAdmin(user.role)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  if (!isManager) {
    return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Fechamento de Expediente</h1>
          <p className="text-gray-600 mt-1 text-sm">Sequência obrigatória para encerrar o dia — os 4 passos precisam estar completos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? <ChevronLeft className="h-4 w-4 mr-1" /> : <History className="h-4 w-4 mr-1" />}
          {showHistory ? "Voltar" : "Histórico de Fechamentos"}
        </Button>
      </div>

      {showHistory ? (
        <ShiftClosingHistory
          onSelect={(date) => {
            setSelectedDate(date)
            setShowHistory(false)
          }}
        />
      ) : (
        <>
          {selectedDate && selectedDate !== todayStr() && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Revisando o fechamento de {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR")}.
              <button className="underline font-medium" onClick={() => setSelectedDate(null)}>
                Voltar para hoje
              </button>
            </div>
          )}
          <ShiftClosingPanel date={selectedDate ?? todayStr()} isMaster={isMaster} />
        </>
      )}
    </div>
  )
}

type ClosingHistoryRow = {
  id: string
  date: string
  status: string
  revenueAmount: string | null
  isMasterOverride: boolean
  isLate: boolean
  closedBy: { name: string } | null
  closedAt: string | null
}

function ShiftClosingHistory({ onSelect }: { onSelect: (date: string) => void }) {
  const [rows, setRows] = useState<ClosingHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    adminFetch<ClosingHistoryRow[]>("/api/company/shift-closing/history")
      .then(setRows)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return <LoadingState />
  if (rows.length === 0) return <EmptyState message="Nenhum fechamento registrado nos últimos 60 dias." />

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.date.slice(0, 10))}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-[#F58220] transition-colors text-left"
        >
          <div>
            <p className="font-medium text-[#3E2415] text-sm">{new Date(r.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
            <p className="text-xs text-gray-500">
              {r.closedBy?.name ?? "—"} {r.isMasterOverride && "· assumido pelo Master"} {r.isLate && "· atrasado"}
            </p>
          </div>
          <div className="text-right flex items-center gap-2">
            <span className="text-sm font-semibold text-[#3E2415]">
              {r.revenueAmount ? Number(r.revenueAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            </span>
            <StatusBadge status={r.status} />
          </div>
        </button>
      ))}
    </div>
  )
}

function ShiftClosingPanel({ date, isMaster }: { date: string; isMaster: boolean }) {
  const user = useCompanyUser()
  const [status, setStatus] = useState<ShiftClosingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [revenueAmount, setRevenueAmount] = useState("")
  const [summary, setSummary] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const evaluationStepRef = useRef<EvaluationStepHandle>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ShiftClosingStatus>(`/api/company/shift-closing?date=${date}`)
      .then((data) => {
        setStatus(data)
        setRevenueAmount(data.closing?.revenueAmount ?? "")
        setSummary(data.closing?.summary ?? "")
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [date])

  const countdown = useCountdown(status?.deadline)
  const isCompleted = status?.closing?.status === "COMPLETED"
  // A Gerente pode (e deve) fechar o expediente mesmo depois do prazo — não
  // trava a tela, só avisa que o Master será notificado do atraso.
  const isLateForGerente = status?.overdue && user.role === "COMPANY_GERENTE" && !isCompleted
  // Fechamento já concluído só pode ser corrigido pelo Master — a Gerente vê um resumo somente-leitura.
  const isLockedForGerente = isCompleted && !isMaster

  const step0Done = isCompleted || Boolean(status?.checklist.step0Complete)
  const step1Done = isCompleted || Boolean(status?.checklist.step1Complete)
  const step2Done = isCompleted || Boolean(status?.checklist.step2Complete)
  const hasPhoto = Boolean(status?.closing?.receiptUrl || file)

  const submitClosing = async (isDraft: boolean) => {
    setError("")
    const body = new FormData()
    body.append("date", date)
    if (revenueAmount) body.append("revenueAmount", revenueAmount)
    if (summary) body.append("summary", summary)
    if (file) body.append("file", file)
    if (isDraft) body.append("isDraft", "true")
    await adminFetch("/api/company/shift-closing", { method: "POST", body })
  }

  const handleSaveDraft = async () => {
    setError("")
    setIsSavingDraft(true)
    try {
      // Rascunho salva o que já estiver preenchido nas notas diárias também —
      // sem exigir que todo mundo tenha nota ainda (ver EvaluationStep.saveDraft).
      await evaluationStepRef.current?.saveDraft()
      await submitClosing(true)
      setSuccess(false)
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar rascunho")
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!step0Done || !step1Done) {
      setError("Complete os passos 0 e 1 antes de concluir o fechamento")
      return
    }
    if (!hasPhoto) {
      setError("A foto do comprovante de fechamento de caixa é obrigatória para concluir e enviar")
      return
    }
    if (!revenueAmount) {
      setError("Informe o faturamento total do dia")
      return
    }
    setIsSubmitting(true)
    try {
      // Garante que toda nota diária esteja preenchida e salva antes de finalizar.
      const notesOk = await evaluationStepRef.current?.saveAllStrict()
      if (notesOk === false) {
        setError("Avalie todos os colaboradores presentes hoje antes de concluir o fechamento")
        setIsSubmitting(false)
        return
      }
      await submitClosing(false)
      setSuccess(true)
      reload()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao registrar fechamento")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || !status) return <LoadingState />

  if (isLockedForGerente) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 space-y-3">
        <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
          <CheckCircle2 className="h-4 w-4" /> Fechamento concluído
          {status.closing?.isMasterOverride && " (corrigido pelo Master)"}
        </div>
        <p className="text-sm text-gray-600">
          Faturamento: <strong>{status.closing?.revenueAmount ? Number(status.closing.revenueAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</strong>
        </p>
        {status.closing?.summary && <p className="text-sm text-gray-600">{status.closing.summary}</p>}
        {status.closing?.receiptUrl && (
          <a href={status.closing.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline w-fit">
            <Camera className="h-3 w-3" /> Ver comprovante <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-500">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
          Este fechamento já foi submetido. Somente o Master pode corrigi-lo.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 shadow-md border ${status.overdue && !isCompleted ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${status.overdue && !isCompleted ? "bg-red-500" : "bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800]"}`}>
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Horário-limite do fechamento: {status.deadline}</p>
            {isCompleted ? (
              <p className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Fechamento concluído
                {status.closing?.isMasterOverride && " (assumido pelo Master)"}
                {!status.closing?.isMasterOverride && status.closing?.isLate && " (atrasado)"}
              </p>
            ) : status.overdue ? (
              <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Prazo estourado{isMaster ? "" : " — finalize para avisar o Master"}
              </p>
            ) : (
              <p className="text-lg font-bold text-[#3E2415]">{countdown?.label} restantes</p>
            )}
          </div>
        </div>
      </div>

      {isLateForGerente && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          O prazo já passou — você ainda pode finalizar o expediente, mas o Master será avisado do atraso.
        </div>
      )}
      <>
          <AdminCard title="Passo 0 — Confirmação de Ponto" icon={Clock}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge done={step0Done} number={0} />
              <p className="text-sm text-gray-600">
                {step0Done
                  ? "Todas as variações de ponto de hoje já foram confirmadas."
                  : `${status.checklist.pendingTimeclockAdjustments.length} variação(ões) de ponto ainda precisam da sua confirmação.`}
              </p>
            </div>
            {!step0Done && (
              <div className="space-y-2">
                {status.checklist.pendingTimeclockAdjustments.map((adj) => (
                  <TimeclockAdjustmentRow key={`${adj.employeeId}:${adj.kind}`} adjustment={adj} date={date} onSaved={reload} />
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard title="Passo 1 — Contas dos Clientes Indicados" icon={ReceiptText}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge done={step1Done} number={1} />
              <p className="text-sm text-gray-600">
                {step1Done
                  ? "Todos os valores de conta do dia já foram confirmados."
                  : `${status.checklist.pendingCommissions.length} indicação(ões) de hoje ainda sem valor de conta confirmado.`}
              </p>
            </div>
            {!step1Done && (
              <div className="space-y-2">
                {status.checklist.pendingCommissions.map((c) => (
                  <PendingCommissionRow key={c.id} commission={c} onSaved={reload} />
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard title="Passo 2 — Nota Diária dos Colaboradores Presentes">
            <div className="flex items-center gap-2 mb-3">
              <StepBadge done={step2Done} number={2} />
              <p className="text-sm text-gray-600">
                {step2Done
                  ? "Todos os colaboradores presentes hoje já foram avaliados."
                  : `Faltam avaliar: ${status.checklist.pendingEmployees.map((e) => e.name).join(", ")}.`}
              </p>
            </div>
            <EvaluationStep ref={evaluationStepRef} date={date} onSaved={reload} disabled={isCompleted && !isMaster} />
          </AdminCard>

          <AdminCard title={isCompleted ? "Passo 3 — Fechamento registrado" : "Passo 3 — Faturamento Total do Caixa"}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge done={isCompleted} number={3} />
              <p className="text-sm text-gray-600">
                Informe o faturamento e anexe a foto do comprovante a qualquer momento — "Salvar como Rascunho" grava o
                preenchimento parcial; "Concluir e Enviar Fechamento" exige os passos 0-2 completos e a foto anexada.
              </p>
            </div>
            {success && isCompleted && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Fechamento concluído e enviado com sucesso.
              </div>
            )}
            <div className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="space-y-2">
                <Label>Faturamento total do dia (R$)</Label>
                <Input type="number" step="0.01" value={revenueAmount} onChange={(e) => setRevenueAmount(e.target.value)} disabled={isCompleted && !isMaster} />
              </div>
              <div className="space-y-2">
                <Label>Foto do Comprovante de Fechamento de Caixa {!status.closing?.receiptUrl && "*"}</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={isCompleted && !isMaster}
                />
                <p className="text-xs text-gray-400">Obrigatória para concluir e enviar — sem ela, só é possível salvar como rascunho.</p>
                {status.closing?.receiptUrl && (
                  <a href={status.closing.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline w-fit">
                    <Camera className="h-3 w-3" /> Ver comprovante atual <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Label>Resumo do dia</Label>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Relato breve das ocorrências do expediente..." disabled={isCompleted && !isMaster} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingDraft || isSubmitting || (isCompleted && !isMaster)}
                  onClick={handleSaveDraft}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-1.5" /> Salvar como Rascunho
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting || isSavingDraft || (isCompleted && !isMaster)}
                  onClick={handleFinish}
                  className="flex-1 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4 mr-1.5" /> {isCompleted ? "Atualizar e Reenviar" : "Concluir e Enviar Fechamento"}
                </Button>
              </div>
            </div>
          </AdminCard>
        </>
    </div>
  )
}

type EvaluationStepHandle = {
  /** Salva só as linhas já preenchidas (parcial é permitido) — usado por "Salvar como Rascunho". */
  saveDraft: () => Promise<void>
  /** Exige TODO colaborador com nota válida; devolve false (sem salvar nada) se faltar alguém — usado por "Concluir e Enviar". */
  saveAllStrict: () => Promise<boolean>
}

type EvalRow = { id: string; name: string; evaluation: { id: string; score: string; justification: string | null; evaluatedBy: { name: string } } | null }

const NEUTRAL_BAND = 1

/**
 * Passo 2 do Fechamento — mesma regra de negócio de app/company/avaliacoes
 * (nota + justificativa obrigatória fora de -1..1), mas SEM botão de salvar
 * por linha: o rascunho fica só em estado local até o rodapé da página
 * (Salvar Rascunho / Concluir e Enviar) decidir gravar tudo de uma vez.
 */
const EvaluationStep = forwardRef<EvaluationStepHandle, { date: string; onSaved: () => void; disabled?: boolean }>(function EvaluationStep(
  { date, onSaved, disabled },
  ref,
) {
  const [rows, setRows] = useState<EvalRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { score: string; justification: string }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    adminFetch<EvalRow[]>(`/api/company/evaluations?date=${date}`)
      .then((data) => {
        setRows(data)
        setDrafts(Object.fromEntries(data.map((r) => [r.id, { score: r.evaluation?.score ?? "", justification: r.evaluation?.justification ?? "" }])))
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [date])

  const validate = (row: EvalRow) => {
    const draft = drafts[row.id]
    const score = Number(draft?.score)
    if (!draft || draft.score === "" || Number.isNaN(score)) return { ok: false as const, empty: true }
    if ((score > NEUTRAL_BAND || score < -NEUTRAL_BAND) && !draft.justification.trim()) {
      return { ok: false as const, empty: false, message: "Justificativa obrigatória para notas fora de -1 a 1" }
    }
    return { ok: true as const, score }
  }

  const saveRow = (row: EvalRow, score: number) =>
    adminFetch("/api/company/evaluations", {
      method: "POST",
      body: JSON.stringify({ employeeId: row.id, dateRaw: date, score, justification: drafts[row.id]?.justification ?? "" }),
    })

  useImperativeHandle(ref, () => ({
    saveDraft: async () => {
      const toSave = rows.filter((row) => {
        const v = validate(row)
        return v.ok
      })
      await Promise.all(toSave.map((row) => saveRow(row, (validate(row) as { ok: true; score: number }).score)))
      if (toSave.length > 0) {
        onSaved()
        reload()
      }
    },
    saveAllStrict: async () => {
      const nextErrors: Record<string, string> = {}
      let allOk = true
      for (const row of rows) {
        const v = validate(row)
        if (!v.ok) {
          allOk = false
          nextErrors[row.id] = v.empty ? "Informe uma nota" : v.message!
        }
      }
      setErrors(nextErrors)
      if (!allOk) return false
      await Promise.all(rows.map((row) => saveRow(row, (validate(row) as { ok: true; score: number }).score)))
      onSaved()
      reload()
      return true
    },
  }))

  if (isLoading) return <LoadingState />
  if (rows.length === 0) return <EmptyState message="Nenhum colaborador presente hoje para avaliar." />

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const draft = drafts[row.id] ?? { score: "", justification: "" }
        const score = Number(draft.score)
        const needsJustification = draft.score !== "" && !Number.isNaN(score) && (score > NEUTRAL_BAND || score < -NEUTRAL_BAND)
        return (
          <div key={row.id} className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="font-semibold text-[#3E2415] flex-1 text-sm">{row.name}</p>
              <Input
                type="number"
                step="0.5"
                placeholder="Nota"
                value={draft.score}
                disabled={disabled}
                onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...draft, score: e.target.value } }))}
                className="w-24"
              />
            </div>
            {needsJustification && (
              <Textarea
                className="mt-2"
                placeholder="Justificativa (obrigatória para notas fora de -1 a 1)"
                value={draft.justification}
                disabled={disabled}
                onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: { ...draft, justification: e.target.value } }))}
              />
            )}
            {errors[row.id] && <p className="text-xs text-red-600 mt-1">{errors[row.id]}</p>}
            {row.evaluation && <p className="text-xs text-gray-400 mt-2">Avaliado por {row.evaluation.evaluatedBy.name}</p>}
          </div>
        )
      })}
    </div>
  )
})

function PendingCommissionRow({ commission, onSaved }: { commission: PendingCommission; onSaved: () => void }) {
  const [amount, setAmount] = useState("")
  const [justification, setJustification] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const isZero = amount !== "" && Number(amount) === 0

  const handleSave = async () => {
    setError("")
    if (amount === "" || Number(amount) < 0) {
      setError("Informe o valor da conta")
      return
    }
    if (isZero && !justification.trim()) {
      setError("Justificativa obrigatória para conta R$ 0,00")
      return
    }
    setIsSaving(true)
    try {
      await adminFetch(`/api/company/shift-closing/commissions/${commission.id}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: Number(amount), billJustification: justification }),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <p className="text-sm text-[#3E2415] flex-1">
          <span className="font-semibold">{commission.clientName}</span>
          <span className="text-gray-500"> · indicado por {commission.partner.name}</span>
        </p>
        <Input type="number" step="0.01" min="0" placeholder="Valor da conta" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36 bg-white" />
        <Button type="button" size="sm" disabled={isSaving} onClick={handleSave} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          Salvar
        </Button>
      </div>
      {isZero && (
        <Textarea
          placeholder="Justificativa para conta R$ 0,00 (obrigatória)"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          className="bg-white"
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

/**
 * Uma variação de ponto por vez — Sim aplica (pede justificativa se o
 * resultado for negativo pro colaborador), Não perdoa sem aplicar nada. Só
 * depois de decidida some da lista (ver TimeclockAdjustmentReview, único por
 * colaborador/dia/tipo).
 */
function TimeclockAdjustmentRow({ adjustment, date, onSaved }: { adjustment: PendingTimeclockAdjustment; date: string; onSaved: () => void }) {
  const [justification, setJustification] = useState("")
  const [asking, setAsking] = useState<"apply" | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const decide = async (apply: boolean) => {
    setError("")
    if (apply && adjustment.isNegativeForEmployee && !justification.trim()) {
      setAsking("apply")
      setError("Justifique o desconto antes de aplicar")
      return
    }
    setIsSaving(true)
    try {
      await adminFetch("/api/company/shift-closing/timeclock-adjustments", {
        method: "POST",
        body: JSON.stringify({ employeeId: adjustment.employeeId, kind: adjustment.kind, apply, justification, date }),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={`rounded-xl p-3 space-y-2 border ${adjustment.isNegativeForEmployee ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <p className="text-sm text-[#3E2415] flex-1">
          <span className="font-semibold">{adjustment.employeeName}</span>
          <span className="text-gray-600"> — {adjustment.label}</span>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => decide(false)} className="text-gray-600">
            <X className="h-3.5 w-3.5 mr-1" /> Não aplicar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => (adjustment.isNegativeForEmployee ? setAsking("apply") : decide(true))}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Aplicar
          </Button>
        </div>
      </div>
      {asking === "apply" && adjustment.isNegativeForEmployee && (
        <div className="space-y-2">
          <Textarea
            placeholder="Justifique o desconto (obrigatório) — ex: colaborador esqueceu de bater o ponto"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="bg-white"
          />
          <Button type="button" size="sm" disabled={isSaving || !justification.trim()} onClick={() => decide(true)} className="bg-red-600 hover:bg-red-700 text-white">
            Confirmar desconto
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
