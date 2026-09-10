"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

/**
 * Modal genérico que exige a digitação de um motivo antes de confirmar uma
 * ação sensível (bloquear/desbloquear empresa ou usuário, reprovar cadastro).
 * O motivo digitado é sempre enviado para a API e gravado em AuditLog — nunca
 * confirma sem preencher.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: (reason: string) => Promise<void> | void
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (reason.trim().length < 5) return
    setIsSubmitting(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (obrigatório)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo desta ação..."
            autoFocus
          />
          {reason.length > 0 && reason.trim().length < 5 && (
            <p className="text-xs text-red-600">Descreva o motivo com pelo menos 5 caracteres.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || reason.trim().length < 5}
            onClick={handleConfirm}
            className={
              destructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
