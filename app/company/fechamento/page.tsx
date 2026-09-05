"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Camera, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, AdminCard, EmptyState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"
import { ManagerEvaluationRoutine } from "@/components/company/manager-evaluation-routine"

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

export default function CompanyFechamentoPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)

  if (!isManager) {
    return <EmptyState message="Acesso restrito à Gerente e ao Administrador da empresa." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Fechamento de Expediente</h1>
        <p className="text-gray-600 mt-1 text-sm">Encerramento diário obrigatório do turno</p>
      </div>
      <ShiftClosingPanel />
    </div>
  )
}

function ShiftClosingPanel() {
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
    adminFetch<ShiftClosingStatus>("/api/company/shift-closing")
      .then((data) => {
        setStatus(data)
        setRevenueAmount(data.closing?.revenueAmount ?? "")
        setSummary(data.closing?.summary ?? "")
      })
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const countdown = useCountdown(status?.deadline)
  const isCompleted = status?.closing?.status === "COMPLETED"
  const isMasterOnlyOverride = status?.overdue && user.role === "COMPANY_GERENTE"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!status?.closing?.receiptUrl && !file) {
      setError("Foto do comprovante de fechamento do caixa é obrigatória")
      return
    }
    setIsSubmitting(true)
    try {
      const body = new FormData()
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
        <AdminCard title={isCompleted ? "Fechamento registrado" : "Encerrar Expediente"}>
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
              <Input type="number" step="0.01" value={revenueAmount} onChange={(e) => setRevenueAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Foto do comprovante de fechamento do caixa {!status.closing?.receiptUrl && "*"}</Label>
              <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {status.closing?.receiptUrl && (
                <a href={status.closing.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#F58220] hover:underline w-fit">
                  <Camera className="h-3 w-3" /> Ver comprovante atual <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="space-y-2">
              <Label>Resumo do dia</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Relato breve das ocorrências do expediente..." />
            </div>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              {isCompleted ? "Atualizar Fechamento" : "Concluir Fechamento"}
            </Button>
          </form>
        </AdminCard>
      )}

      <AdminCard title="Notas Diárias da Equipe">
        <ManagerEvaluationRoutine />
      </AdminCard>
    </div>
  )
}
