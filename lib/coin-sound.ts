"use client"

/**
 * Efeito sonoro de caixa registradora/moedas — sintetizado via Web Audio API
 * (sem asset de áudio). Disparado quando chega uma notificação de "Valor
 * Recebido" (PAYMENT_RECEIVED), "Saque Aprovado" (WITHDRAWAL_APPROVED) ou
 * "Comissão Creditada" (COMMISSION_EARNED) / bônus (BONUS_AWARDED), ver
 * components/notifications/notification-bell.tsx, respeitando
 * User.soundOnEarnings.
 *
 * Mobile/PWA: navegadores só liberam áudio depois de um gesto do usuário, então
 * o AudioContext é único e destravado no primeiro toque/clique/tecla da sessão
 * (um som disparado por polling, sem gesto anterior, seria bloqueado).
 */
type AudioContextCtor = typeof AudioContext

let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (sharedContext && sharedContext.state !== "closed") return sharedContext
  const Ctor: AudioContextCtor | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null
  sharedContext = new Ctor()
  return sharedContext
}

function unlock() {
  const ctx = getContext()
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {})
}

if (typeof window !== "undefined") {
  for (const eventName of ["pointerdown", "touchstart", "keydown"] as const) {
    window.addEventListener(eventName, unlock, { passive: true, once: false })
  }
}

function tone(ctx: AudioContext, type: OscillatorType, freq: number, start: number, duration: number, peak: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

export function playCoinSound() {
  const ctx = getContext()
  if (!ctx) return

  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    const now = ctx.currentTime + 0.02

    // Moedas caindo: três blips agudos curtos.
    ;[1568, 1976, 2349].forEach((freq, i) => tone(ctx, "triangle", freq, now + i * 0.08, 0.18, 0.22))
    // "Ka-ching" da caixa: sino com parciais inarmônicos + acorde final.
    ;[1318.5, 2637, 3951].forEach((freq, i) => tone(ctx, "sine", freq, now + 0.26, 0.9 - i * 0.2, 0.16 / (i + 1)))
    ;[523.25, 659.25, 783.99].forEach((freq) => tone(ctx, "sine", freq, now + 0.3, 0.7, 0.12))
  } catch {
    // Ambiente sem suporte a Web Audio — falha silenciosa, não é crítico.
  }
}
