"use client"

import { MapPin, Phone, Gift, CalendarClock, Navigation } from "lucide-react"
import { fullAddress, googleMapsRouteUrl, telUrl, wazeRouteUrl, whatsappUrl, type VoucherCompany } from "@/lib/voucher-links"

export type VoucherDisplayProps = {
  qrDataUrl: string
  clientName?: string | null
  partnerName?: string | null
  promotionTitle: string
  benefit: string
  validUntil?: string | Date | null
  company: VoucherCompany & { profilePictureUrl?: string | null }
  /** Esconde os botões de rota/ligação (ex: pré-visualização compacta). */
  hideActions?: boolean
}

/**
 * Voucher do cliente indicado: QR Code grande para apresentar no estabelecimento,
 * benefício, endereço completo com [TRAÇAR ROTA ATÉ O LOCAL] (Google Maps/Waze nas
 * coordenadas exatas) e telefone/WhatsApp oficial com [LIGAR / RESERVAR].
 * Usado na página pública /voucher/<code> e na tela do parceiro (cliente sem contato).
 */
export function VoucherDisplay({ qrDataUrl, clientName, partnerName, promotionTitle, benefit, validUntil, company, hideActions }: VoucherDisplayProps) {
  const address = fullAddress(company)
  const tel = telUrl(company.phone)
  const wa = whatsappUrl(company.phone, `Olá! Tenho um voucher "${promotionTitle}" e gostaria de reservar.`)

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white border border-gray-100 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] px-5 py-3 text-center">
          <p className="text-white text-xs font-bold tracking-wide flex items-center justify-center gap-1.5">
            <Gift className="h-4 w-4" /> VOCÊ GANHOU UM BENEFÍCIO
          </p>
        </div>
        <div className="p-5 text-center space-y-3">
          {(clientName || partnerName) && (
            <p className="text-sm text-gray-600">
              {clientName && <strong className="text-[#3E2415]">{clientName}</strong>}
              {clientName && partnerName && " · "}
              {partnerName && <>indicação de {partnerName}</>}
            </p>
          )}
          <h2 className="text-xl font-bold text-[#3E2415] leading-tight">{promotionTitle}</h2>
          <span className="inline-flex items-center text-sm font-bold text-white bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full px-4 py-1.5 shadow-sm">{benefit}</span>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR Code do voucher" className="mx-auto w-full max-w-[18rem] aspect-square rounded-2xl border border-gray-100 bg-white p-2" />
          <p className="text-xs text-gray-500">Apresente este QR Code no estabelecimento (se preferir, tire um print).</p>
          {validUntil && (
            <p className="text-xs font-medium text-amber-700 flex items-center justify-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> Válido até {new Date(validUntil).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-gray-100 shadow-md p-5 space-y-3">
        <div className="flex items-start gap-3">
          {company.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.profilePictureUrl} alt={company.name} className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-6 w-6 text-[#F2680C]" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-[#3E2415]">{company.name}</p>
            {address && <p className="text-sm text-gray-600">{address}</p>}
          </div>
        </div>

        {!hideActions && (
          <div className="space-y-2.5">
            <a
              href={googleMapsRouteUrl(company)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full min-h-14 rounded-2xl bg-[#F2680C] text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform"
            >
              <span aria-hidden>🗺️</span> TRAÇAR ROTA ATÉ O LOCAL
            </a>
            <a
              href={wazeRouteUrl(company)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full min-h-11 rounded-xl border border-[#F2680C]/30 text-[#F2680C] font-semibold text-sm"
            >
              <Navigation className="h-4 w-4" /> Abrir no Waze
            </a>
            {tel && (
              <a href={tel} className="flex items-center justify-center gap-2 w-full min-h-14 rounded-2xl bg-[#3E2415] text-white font-bold text-base shadow-md active:scale-[0.99] transition-transform">
                <Phone className="h-5 w-5" /> <span aria-hidden>📞</span> LIGAR / RESERVAR
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full min-h-11 rounded-xl border border-green-200 text-green-700 font-semibold text-sm">
                Chamar no WhatsApp {company.phone && <span className="text-xs font-normal">({company.phone})</span>}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
