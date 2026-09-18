"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

/** Selo de nota — só leitura (cards de programa, header de empresa). */
export function StarRatingDisplay({ value, count, size = "sm" }: { value: number | string | null; count?: number; size?: "sm" | "md" }) {
  const numeric = value ? Number(value) : null
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"

  if (!numeric) {
    return <span className="text-xs text-gray-400">Sem avaliações ainda</span>
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(starSize, i <= Math.round(numeric) ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
        ))}
      </span>
      <span className="text-xs font-medium text-gray-600">
        {numeric.toFixed(1)}
        {count !== undefined && <span className="text-gray-400"> ({count})</span>}
      </span>
    </span>
  )
}

/** Seletor interativo de 1 a 5 estrelas — usado no modal de Avaliação Rápida. */
export function StarRatingInput({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="p-0.5"
          aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
        >
          <Star className={cn("h-8 w-8 transition-colors", i <= display ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
        </button>
      ))}
    </div>
  )
}
