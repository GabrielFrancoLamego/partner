"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Camera, CheckCircle2, AlertTriangle, ExternalLink, Lock, ReceiptText, History, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, AdminCard, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations, isCompanyMasterOrAdmin } from "@/lib/permissions"
import { ManagerEvaluationRoutine } from "@/components/company/manager-evaluation-routine"

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

type PendingCommission = { id: string; clientName: string; commissionValue: string | null; partner: { name: string } }
type PendingEmployee = { id: string; name: string }

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
    closedBy: { name: string } | null
    closedAt: string | null
  } | null
  checklist: {
    pendingCommissions: PendingCommission[]
    pendingEmployees: PendingEmployee[]
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
          <p className="text-gray-600 mt-1 text-sm">Sequência obrigatória para encerrar o dia — os 3 passos precisam estar completos.</p>
        </div>
        {isMaster && (
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? <ChevronLeft className="h-4 w-4 mr-1" /> : <History className="h-4 w-4 mr-1" />}
            {showHistory ? "Voltar" : "Histórico de Fechamentos"}
          </Button>
        )}
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
              {r.closedBy?.name ?? "—"} {r.isMasterOverride && "· assumido pelo Master"}
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

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
  const isMasterOnlyOverride = status?.overdue && user.role === "COMPANY_GERENTE"
  // Fechamento já concluído só pode ser corrigido pelo Master — a Gerente vê um resumo somente-leitura.
  const isLockedForGerente = isCompleted && !isMaster

  const step1Done = isCompleted || Boolean(status?.checklist.step1Complete)
  const step2Done = isCompleted || Boolean(status?.checklist.step2Complete)
  const step3Ready = Boolean((status?.closing?.receiptUrl || file) && revenueAmount)
  const canFinish = step1Done && step2Done && step3Ready

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!canFinish) {
      setError("Complete os 3 passos da sequência antes de finalizar o expediente")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
      body.append("date", date)
      if (revenueAmount) body.append("revenueAmount", revenueAmount)
      if (summary) body.append("summary", summary)
      if (file) body.append("file", file)
      await adminFetch("/api/company/shift-closing", { method: "POST", body })
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
              </p>
            ) : status.overdue ? (
              <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Prazo estourado — PENDENTE_MASTER
              </p>
            ) : (
              <p className="text-lg font-bold text-[#3E2415]">{countdown?.label} restantes</p>
            )}
          </div>
        </div>
      </div>

      {isMasterOnlyOverride && !isCompleted ? (
        <EmptyState message="O prazo estourou — apenas o Master pode concluir o fechamento agora." />
      ) : (
        <>
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
            <ManagerEvaluationRoutine onSaved={reload} />
          </AdminCard>

          <AdminCard title={isCompleted ? "Passo 3 — Fechamento registrado" : "Passo 3 — Faturamento Total do Caixa"}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge done={isCompleted} number={3} />
              {!step1Done || !step2Done ? (
                <p className="text-sm text-amber-700 flex items-center gap-1.5">
                  <Lock className="h-4 w-4" /> Conclua os passos 1 e 2 para liberar o fechamento.
                </p>
              ) : (
                <p className="text-sm text-gray-600">Informe o faturamento total e anexe a foto do comprovante.</p>
              )}
            </div>
            {success && isCompleted && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Fechamento salvo com sucesso.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="space-y-2">
                <Label>Faturamento total do dia (R$)</Label>
                <Input type="number" step="0.01" value={revenueAmount} onChange={(e) => setRevenueAmount(e.target.value)} disabled={!step1Done || !step2Done} />
              </div>
              <div className="space-y-2">
                <Label>Foto do comprovante de fechamento do caixa {!status.closing?.receiptUrl && "*"}</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={!step1Done || !step2Done}
                />
                {status.closing?.receiptUrl && (
                  <a href={status.closing.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline w-fit">
                    <Camera className="h-3 w-3" /> Ver comprovante atual <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Label>Resumo do dia</Label>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Relato breve das ocorrências do expediente..." disabled={!step1Done || !step2Done} />
              </div>
              <Button type="submit" disabled={isSubmitting || !canFinish} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white disabled:opacity-40">
                {isCompleted ? "Atualizar Fechamento" : "Finalizar Expediente"}
              </Button>
            </form>
          </AdminCard>
        </>
      )}
    </div>
  )
}

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
