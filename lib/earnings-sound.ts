"use client"

/**
 * Efeito sonoro de "ganho financeiro" (estilo caixa registradora/moedas) —
 * sintetizado via Web Audio API em vez de um arquivo de áudio, para não
 * depender de nenhum asset licenciado. Disparado quando uma notificação
 * COMMISSION_EARNED/BONUS_AWARDED chega (ver components/notifications/
 * notification-bell.tsx) e o usuário não desativou em Preferências de
 * Notificação (User.soundOnEarnings).
 */
export function playEarningsSound() {
  if (typeof window === "undefined") return
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  try {
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Duas "moedas" caindo (blips agudos curtos) + um acorde final de "caixa".
    const blipTimes = [0, 0.09]
    const blipFreqs = [1568, 1976] // G6, B6
    blipTimes.forEach((t, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(blipFreqs[i], now + t)
      gain.gain.setValueAtTime(0, now + t)
      gain.gain.linearRampToValueAtTime(0.25, now + t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + t)
      osc.stop(now + t + 0.2)
    })

    const chordFreqs = [523.25, 659.25, 783.99] // C5 E5 G5
    const chordStart = now + 0.2
    chordFreqs.forEach((freq) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, chordStart)
      gain.gain.setValueAtTime(0, chordStart)
      gain.gain.linearRampToValueAtTime(0.18, chordStart + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(chordStart)
      osc.stop(chordStart + 0.65)
    })

    setTimeout(() => ctx.close().catch(() => {}), 1000)
  } catch {
    // Ambiente sem suporte a Web Audio (raro) — falha silenciosa, não é crítico.
  }
}
