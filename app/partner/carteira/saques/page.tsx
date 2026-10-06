"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarClock, CheckCircle2, Clock, FileText, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { ProofViewer, currencyNum, formatDateTime } from "@/components/company/finance/finance-shared"

type Withdrawal = {
  id: string
  amount: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  requestDate: string
  approvedAt: string | null
  expectedPaymentDate: string | null
  paidAt: string | null
  proofOfPaymentUrl: string | null
  rejectionReason: string | null
  pixKey: string | null
  company: { id: string; name: string }
}

const STATUS = {
  PENDING: { label: "Pendente", tone: "bg-amber-50 text-amber-700", icon: Clock },
  APPROVED: { label: "Aprovado", tone: "bg-blue-50 text-blue-700", icon: CalendarClock },
  PAID: { label: "Pago", tone: "bg-green-50 text-green-700", icon: CheckCircle2 },
  REJECTED: { label: "Recusado", tone: "bg-red-50 text-red-700", icon: XCircle },
} as const

/** Acompanhamento dos saques solicitados pelo parceiro: pendente, aprovado (data prevista), pago (comprovante) ou recusado (motivo). */
export default function PartnerWithdrawalsTrackingPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null)
  const [proof, setProof] = useState<Withdrawal | null>(null)

  useEffect(() => {
    adminFetch<Withdrawal[]>("/api/partner/withdrawals").then(setWithdrawals)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/partner/comissoes" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Meus Saques Solicitados</h1>
          <p className="text-gray-600 mt-1 text-sm">Acompanhe o andamento de cada solicitação</p>
        </div>
      </div>

      {!withdrawals ? (
        <LoadingState />
      ) : withdrawals.length === 0 ? (
        <EmptyState message="Você ainda não solicitou nenhum saque." />
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => {
            const status = STATUS[w.status]
            const Icon = status.icon
            return (
              <div key={w.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-[#3E2415]">{currencyNum(Number(w.amount))}</p>
                    <p className="text-xs text-gray-500">
                      {w.company.name} · solicitado em {formatDateTime(w.requestDate)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>
                    <Icon className="h-3.5 w-3.5" /> {status.label}
                  </span>
                </div>

                {w.status === "PENDING" && <p className="text-sm text-gray-600">Sua solicitação está aguardando análise do financeiro.</p>}
                {w.status === "APPROVED" && (
                  <p className="text-sm text-gray-600">
                    Aprovado — pagamento previsto para <strong className="text-[#3E2415]">{formatDateTime(w.expectedPaymentDate ?? w.approvedAt)}</strong>
                    {w.pixKey && <> via PIX {w.pixKey}</>}.
                  </p>
                )}
                {w.status === "PAID" && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-gray-600">
                      Pago em <strong className="text-[#3E2415]">{formatDateTime(w.paidAt)}</strong>.
                    </p>
                    {w.proofOfPaymentUrl && (
                      <Button size="sm" variant="outline" onClick={() => setProof(w)}>
                        <FileText className="h-4 w-4 mr-1.5" /> Ver comprovante
                      </Button>
                    )}
                  </div>
                )}
                {w.status === "REJECTED" && (
                  <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
                    Recusado{w.rejectionReason ? <>: {w.rejectionReason}</> : "."} O valor voltou para a sua carteira.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {proof?.proofOfPaymentUrl && (
        <Dialog open onOpenChange={(open) => !open && setProof(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Comprovante do saque de {currencyNum(Number(proof.amount))}</DialogTitle>
            </DialogHeader>
            <ProofViewer url={proof.proofOfPaymentUrl} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
