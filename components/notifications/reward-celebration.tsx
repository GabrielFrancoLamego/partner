"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const COIN_COUNT = 26
const COIN_EMOJIS = ["🪙", "💰"]

type Coin = { left: number; delay: number; duration: number; size: number; rotate: number; emoji: string }

function randomCoins(): Coin[] {
  return Array.from({ length: COIN_COUNT }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.4,
    duration: 2.2 + Math.random() * 1.8,
    size: 18 + Math.random() * 18,
    rotate: 180 + Math.random() * 540,
    emoji: COIN_EMOJIS[Math.floor(Math.random() * COIN_EMOJIS.length)],
  }))
}

/**
 * Modal de celebração "Meta/Bônus/Prêmio recebido" — chuva de moedas +
 * destaque central. Disparado pelo NotificationBell junto com o efeito
 * sonoro (lib/coin-sound.ts) sempre que chega uma notificação nova do
 * tipo COMMISSION_EARNED/BONUS_AWARDED, para Colaborador OU Parceiro (o sino
 * já é compartilhado entre os 2 papéis).
 */
export function RewardCelebration({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const [coins] = useState(randomCoins)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 pointer-events-none">
        {coins.map((c, i) => (
          <span
            key={i}
            className="absolute -top-10 select-none animate-coin-fall"
            style={{
              left: `${c.left}%`,
              fontSize: `${c.size}px`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              ["--coin-rotate" as string]: `${c.rotate}deg`,
            }}
          >
            {c.emoji}
          </span>
        ))}
      </div>

      <div
        className="relative bg-white rounded-3xl p-8 max-w-sm w-[calc(100%-2rem)] text-center shadow-2xl animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">🏆</div>
        <h2 className="font-heading text-xl font-bold text-[#3E2415] mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <Button onClick={onClose} className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          Uhul!
        </Button>
      </div>
    </div>
  )
}
