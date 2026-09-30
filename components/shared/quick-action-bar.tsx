"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ScanLine, MapPin, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type EntryType = "CHECK_IN" | "BREAK_START" | "BREAK_END" | "CHECK_OUT"

const NEXT: Record<"START" | EntryType, EntryType> = {
  START: "CHECK_IN",
  CHECK_IN: "BREAK_START",
  BREAK_START: "BREAK_END",
  BREAK_END: "CHECK_OUT",
  CHECK_OUT: "CHECK_IN",
}
const TYPE_LABELS: Record<EntryType, string> = {
  CHECK_IN: "Entrada",
  BREAK_START: "Pausa",
  BREAK_END: "Retorno",
  CHECK_OUT: "Saída",
}

const RADIUS = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Barra fixa inferior (mobile) com os 2 botões mais usados no dia a dia do
 * Colaborador — Ponto Digital e Scanner PDV — centralizados e em destaque,
 * sempre visíveis em qualquer tela (inclusive a inicial).
 *
 * O botão de Ponto muda de estado sozinho:
 *  - Nenhuma batida (ou próxima batida pendente) -> pulsa em laranja, pede ação.
 *  - Já em andamento (entre a 1ª entrada e a próxima batida esperada) -> um
 *    anel vai se preenchendo conforme o tempo passa (como um relógio sendo
 *    contabilizado), sem precisar abrir a tela de Ponto Digital pra ver.
 * Um toque já registra a próxima batida esperada, direto daqui.
 */
export function QuickActionBar() {
  const router = useRouter()
  const [lastType, setLastType] = useState<"START" | EntryType>("START")
  const [firstCheckInAt, setFirstCheckInAt] = useState<Date | null>(null)
  const [workStartTime, setWorkStartTime] = useState<string | null>(null)
  const [workEndTime, setWorkEndTime] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justPunched, setJustPunched] = useState(false)
  const [error, setError] = useState("")
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadStatus = () => {
    fetch("/api/company/timeclock?days=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((entries: { type: EntryType; createdAt: string }[]) => {
        if (entries.length > 0) {
          setLastType(entries[0].type)
          const checkIn = entries.find((e) => e.type === "CHECK_IN")
          setFirstCheckInAt(checkIn ? new Date(checkIn.createdAt) : null)
        } else {
          setLastType("START")
          setFirstCheckInAt(null)
        }
      })
      .catch(() => {})
    fetch("/api/company/my-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { workStartTime?: string | null; workEndTime?: string | null } | null) => {
        if (data) {
          setWorkStartTime(data.workStartTime ?? null)
          setWorkEndTime(data.workEndTime ?? null)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  // Relógio se enchendo: proporção do turno já decorrida desde a 1ª entrada
  // até o horário previsto de saída (ou, sem horário configurado, uma janela
  // de referência de 8h) — atualiza a cada 30s para a animação avançar sozinha.
  useEffect(() => {
    const compute = () => {
      if (!firstCheckInAt || lastType === "CHECK_OUT" || lastType === "START") {
        setProgress(0)
        return
      }
      const now = new Date()
      let totalMinutes = 8 * 60
      if (workStartTime && workEndTime) {
        const [sh, sm] = workStartTime.split(":").map(Number)
        const [eh, em] = workEndTime.split(":").map(Number)
        totalMinutes = Math.max(60, eh * 60 + em - (sh * 60 + sm))
      }
      const elapsedMinutes = (now.getTime() - firstCheckInAt.getTime()) / 60000
      setProgress(Math.max(0.03, Math.min(1, elapsedMinutes / totalMinutes)))
    }
    compute()
    tickRef.current = setInterval(compute, 30000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [firstCheckInAt, lastType, workStartTime, workEndTime])

  const expected = NEXT[lastType]
  const inProgress = lastType !== "START" && lastType !== "CHECK_OUT"

  const handlePunch = () => {
    setError("")
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada neste dispositivo")
      return
    }
    setIsSubmitting(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch("/api/company/timeclock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: expected, latitude: position.coords.latitude, longitude: position.coords.longitude }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            throw new Error(body?.error ?? "Erro ao registrar ponto")
          }
          setJustPunched(true)
          setTimeout(() => setJustPunched(false), 2500)
          loadStatus()
          router.refresh()
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erro ao registrar ponto")
          setTimeout(() => setError(""), 4000)
        } finally {
          setIsSubmitting(false)
        }
      },
      () => {
        setError("Não foi possível obter sua localização")
        setTimeout(() => setError(""), 4000)
        setIsSubmitting(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#E8E3DC] px-6"
      style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      {error && (
        <div className="absolute -top-10 left-4 right-4 text-center">
          <span className="inline-block px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-medium shadow-lg">{error}</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-10 py-2.5">
        <button
          onClick={handlePunch}
          disabled={isSubmitting}
          aria-label={`Bater ponto — ${TYPE_LABELS[expected]}`}
          className="relative flex flex-col items-center gap-0.5"
        >
          <span className="relative flex items-center justify-center w-14 h-14">
            {inProgress && (
              <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="#F0E9E1" strokeWidth="4" />
                <circle
                  cx="28"
                  cy="28"
                  r={RADIUS}
                  fill="none"
                  stroke="url(#quickActionGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
                <defs>
                  <linearGradient id="quickActionGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F2680C" />
                    <stop offset="100%" stopColor="#FFC800" />
                  </linearGradient>
                </defs>
              </svg>
            )}
            {!inProgress && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-[#FB9C08] opacity-40" />
              </span>
            )}
            <span
              className={cn(
                "relative flex items-center justify-center w-12 h-12 rounded-full shadow-md",
                justPunched
                  ? "bg-green-500"
                  : "bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800]",
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : justPunched ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <MapPin className="w-5 h-5 text-white" />
              )}
            </span>
          </span>
          <span className="text-[10px] font-semibold text-[#3E2415] whitespace-nowrap">
            {justPunched ? "Registrado!" : TYPE_LABELS[expected]}
          </span>
        </button>

        <Link href="/company/scanner" className="flex flex-col items-center gap-0.5">
          <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#3E2415] shadow-md">
            <ScanLine className="w-5 h-5 text-white" />
          </span>
          <span className="text-[10px] font-semibold text-[#3E2415] whitespace-nowrap">Scanner</span>
        </Link>
      </div>
    </div>
  )
}
