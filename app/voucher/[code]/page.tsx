"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { VoucherDisplay } from "@/components/shared/voucher-display"
import type { VoucherCompany } from "@/lib/voucher-links"

type VoucherData = {
  status: "VALID" | "REDEEMED" | "EXPIRED" | "CANCELED"
  clientName: string | null
  partnerName: string | null
  expiresAt: string | null
  qrDataUrl: string | null
  promotion: { title: string; description: string; bannerUrl: string | null; benefit: string }
  company: VoucherCompany & { profilePictureUrl: string | null }
}

const BLOCKED_MESSAGE = {
  REDEEMED: "Este voucher já foi utilizado.",
  EXPIRED: "Este voucher expirou.",
  CANCELED: "Este voucher foi cancelado.",
} as const

/**
 * Página pública do voucher (sem login) — é o link enviado ao cliente indicado:
 * QR Code, endereço com [TRAÇAR ROTA ATÉ O LOCAL] e telefone com [LIGAR / RESERVAR].
 */
export default function VoucherPage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<VoucherData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/public/vouchers/${code}`)
      .then(async (res) => {
        if (!res.ok) return setNotFound(true)
        setData(await res.json())
      })
      .catch(() => setNotFound(true))
  }, [code])

  return (
    <main className="min-h-screen bg-[#F7F5F2] overflow-x-hidden px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2">
          <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-heading text-sm font-semibold text-[#3E2415]">Voucher Tribuss</span>
        </div>

        {notFound ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center text-sm text-gray-600">Voucher não encontrado. Confira o link recebido.</div>
        ) : !data ? (
          <p className="text-center text-sm text-gray-400 py-16">Carregando seu voucher...</p>
        ) : data.status !== "VALID" || !data.qrDataUrl ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center space-y-2">
            <p className="font-bold text-[#3E2415]">{data.promotion.title}</p>
            <p className="text-sm text-gray-600">{BLOCKED_MESSAGE[data.status === "VALID" ? "EXPIRED" : data.status]}</p>
          </div>
        ) : (
          <VoucherDisplay
            qrDataUrl={data.qrDataUrl}
            clientName={data.clientName}
            partnerName={data.partnerName}
            promotionTitle={data.promotion.title}
            benefit={data.promotion.benefit}
            validUntil={data.expiresAt}
            company={data.company}
          />
        )}
      </div>
    </main>
  )
}
