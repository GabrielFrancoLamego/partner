"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

type DeletionStatus = {
  accountDeletionStatus: "NONE" | "ACCOUNT_DELETION_REQUESTED"
  accountDeletionRequestedAt: string | null
}

/**
 * Botão obrigatório de exclusão de conta (Apple Guideline 5.1.1(v) + LGPD) —
 * usar em /partner/perfil e /company/perfil. Não apaga nada na hora: só
 * registra o pedido (ver POST /api/account/deletion-request) para um Admin
 * revisar manualmente — evitamos exclusão automática/imediata para não
 * derrubar dados financeiros (comissões, saques) vinculados ao usuário.
 */
export function AccountDeletionRequest() {
  const [status, setStatus] = useState<DeletionStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<DeletionStatus>("/api/account/deletion-request")
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  const handleConfirm = async () => {
    setError("")
    setIsSubmitting(true)
    try {
      const updated = await adminFetch<DeletionStatus>("/api/account/deletion-request", {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      setStatus(updated)
      setOpen(false)
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Não foi possível registrar sua solicitação")
    } finally {
      setIsSubmitting(false)
    }
  }

  const alreadyRequested = status?.accountDeletionStatus === "ACCOUNT_DELETION_REQUESTED"

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-red-900 text-sm">Excluir minha conta</h4>
          <p className="text-xs text-red-700/80 mt-0.5">
            Esta ação envia um pedido de exclusão definitiva da sua conta e dos seus dados para análise da nossa
            equipe. Não pode ser desfeita após a aprovação.
          </p>
        </div>
      </div>

      {alreadyRequested ? (
        <p className="text-xs font-medium text-red-800 bg-red-100 rounded-lg px-3 py-2">
          Solicitação enviada
          {status?.accountDeletionRequestedAt
            ? ` em ${new Date(status.accountDeletionRequestedAt).toLocaleDateString("pt-BR")}`
            : ""}{" "}
          — em análise pelo Admin.
        </p>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="min-h-11"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Solicitar Exclusão da Minha Conta
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar exclusão da conta</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o pedido de exclusão definitiva da sua conta? Um administrador vai revisar a solicitação. Você
              pode contar o motivo (opcional) para agilizar a análise.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            rows={3}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" className="min-h-11" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Confirmar exclusão"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
