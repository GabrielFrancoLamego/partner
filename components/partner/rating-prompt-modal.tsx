"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch } from "@/lib/admin-api-client"
import { StarRatingInput } from "./star-rating"

type PendingCompany = { id: string; name: string; profilePictureUrl: string | null }

/**
 * Avaliação Rápida — sempre que o parceiro acessa o portal, uma empresa com
 * programa ativo ainda não avaliada por ele aparece aqui (fila 1 a 1). Montado
 * uma vez no PartnerShell para cobrir qualquer tela, inclusive o dashboard (task 2).
 */
export function RatingPromptModal() {
  const [queue, setQueue] = useState<PendingCompany[] | null>(null)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    adminFetch<PendingCompany[]>("/api/partner/ratings")
      .then(setQueue)
      .catch(() => setQueue([]))
  }, [])

  if (!queue || queue.length === 0) return null
  const current = queue[0]

  const handleSkip = () => {
    setQueue(queue.slice(1))
    setStars(0)
    setComment("")
  }

  const handleSubmit = async () => {
    if (stars === 0) return
    setIsSubmitting(true)
    try {
      await adminFetch("/api/partner/ratings", {
        method: "POST",
        body: JSON.stringify({ companyId: current.id, stars, comment: comment || undefined }),
      })
      handleSkip()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Como foi sua experiência com {current.name}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {current.profilePictureUrl && (
            <img src={current.profilePictureUrl} alt={current.name} className="w-16 h-16 rounded-xl object-cover mx-auto" />
          )}
          <div className="flex justify-center">
            <StarRatingInput value={stars} onChange={setStars} />
          </div>
          <Textarea
            placeholder="Comentário opcional..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleSkip}>
              Agora não
            </Button>
            <Button type="button" variant="brand" className="flex-1" disabled={stars === 0 || isSubmitting} onClick={handleSubmit}>
              Avaliar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
