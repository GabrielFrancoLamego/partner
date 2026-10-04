"use client"

import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"

type Summary = {
  me: {
    xpPoints: number
    currentLevel: { name: string; badgeColorHex: string } | null
  } | null
}

/** Badge de Nível + Pts no topo da tela do colaborador (Header Gamificado) — reaproveita /api/company/gamification/summary. */
export function EmployeeLevelBadge() {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    fetch("/api/company/gamification/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {})
  }, [])

  if (!summary?.me) return null

  const level = summary.me.currentLevel
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 text-white text-xs font-semibold shadow-sm"
      style={{ backgroundColor: level?.badgeColorHex ?? "#F58220" }}
      title={level ? `${level.name} — ${summary.me.xpPoints} Pts` : `${summary.me.xpPoints} Pts`}
    >
      <Trophy className="h-3.5 w-3.5" />
      <span className="truncate max-w-[90px]">{level?.name ?? "Sem nível"}</span>
      <span className="opacity-90">· {summary.me.xpPoints} Pts</span>
    </div>
  )
}
