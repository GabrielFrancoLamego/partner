"use client"

import { useEffect, useState } from "react"
import { Send, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-api-client"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { GENERATE_VOUCHER_EVENT } from "@/components/partner/generate-voucher-dialog"

type Promotion = {
  id: string
  title: string
  description: string
  bannerUrl: string | null
  offerType: "DISCOUNT" | "FREE_GIFT" | "DOUBLE_BENEFIT" | "CASH_CREDIT"
  originalPrice: string | null
  discountedPrice: string | null
  discountPercentage: string | null
  creditAmount: string | null
  validUntil: string
  company: { id: string; name: string; profilePictureUrl: string | null }
}

function benefitLabel(p: Promotion) {
  if (p.offerType === "FREE_GIFT") return "Brinde gratuito"
  if (p.offerType === "DOUBLE_BENEFIT") return "Pediu 1, levou 2"
  if (p.offerType === "CASH_CREDIT") return p.creditAmount ? `R$ ${p.creditAmount} de crédito` : "Crédito na comanda"
  if (p.discountPercentage) return `${p.discountPercentage}% OFF`
  if (p.originalPrice && p.discountedPrice) return `R$ ${p.originalPrice} → R$ ${p.discountedPrice}`
  return "Desconto especial"
}

export function MyPromotionsTab({ onDiscover }: { onDiscover: () => void }) {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    adminFetch<Promotion[]>("/api/partner/promotions").then(setPromotions).finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">Promoções ativas das empresas cujo Programa de Parceria você já aderiu.</p>

      {isLoading ? (
        <LoadingState />
      ) : promotions.length === 0 ? (
        <div className="space-y-3">
          <EmptyState message="Nenhuma promoção disponível ainda — participe de um Programa de Parceria para liberar promoções." />
          <div className="flex justify-center">
            <Button variant="brand" onClick={onDiscover}>
                <Compass className="h-4 w-4 mr-1.5" /> Descobrir Promoções
              </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => (
            <div key={p.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col">
              {/* Logo da empresa em destaque no topo do card */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                {p.company.profilePictureUrl ? (
                  <img
                    src={p.company.profilePictureUrl}
                    alt={p.company.name}
                    className="w-8 h-8 rounded-full object-cover border border-gray-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                )}
                <p className="text-xs font-medium text-gray-600 truncate">{p.company.name}</p>
              </div>

              {/* Banner quadrado da promoção */}
              <div className="w-full aspect-square bg-gradient-to-br from-[#F2680C]/10 to-[#FFC800]/10">
                {p.bannerUrl && <img src={p.bannerUrl} alt={p.title} className="w-full h-full object-cover" />}
              </div>

              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <p className="font-semibold text-[#3E2415] leading-tight">{p.title}</p>
                <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                <span className="inline-flex self-start items-center text-xs font-bold text-white bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-full px-3 py-1 shadow-sm">
                  {benefitLabel(p)}
                </span>
                <p className="text-[10px] text-gray-400">Válida até {new Date(p.validUntil).toLocaleDateString("pt-BR")}</p>

                <div className="flex-1" />

                <Button
                  onClick={() => window.dispatchEvent(new CustomEvent(GENERATE_VOUCHER_EVENT, { detail: { companyId: p.company.id, promotionId: p.id } }))}
                  className="w-full mt-2 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar ao Cliente
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
