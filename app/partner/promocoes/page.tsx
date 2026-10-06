"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LoadingState } from "@/components/admin/admin-ui"
import { MyPromotionsTab } from "@/components/partner/my-promotions-tab"
import { DiscoverPromotionsTab } from "@/components/partner/discover-promotions-tab"

const TABS = ["aderidas", "descobrir"] as const
type TabKey = (typeof TABS)[number]

function PromotionsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get("tab")
  const tab: TabKey = TABS.includes(requested as TabKey) ? (requested as TabKey) : "aderidas"
  const go = (value: string) => router.replace(`/partner/promocoes?tab=${value}`, { scroll: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Promoções</h1>
        <p className="text-gray-600 mt-1 text-sm">Suas promoções aderidas e a vitrine para descobrir novas.</p>
      </div>
      <Tabs value={tab} onValueChange={go}>
        <TabsList className="w-full justify-start h-auto">
          <TabsTrigger value="aderidas" className="flex-1 sm:flex-none min-h-11">Minhas Promoções Aderidas</TabsTrigger>
          <TabsTrigger value="descobrir" className="flex-1 sm:flex-none min-h-11">Descobrir Novas Promoções</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="aderidas">
            <MyPromotionsTab onDiscover={() => go("descobrir")} />
          </TabsContent>
          <TabsContent value="descobrir">
            <DiscoverPromotionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default function PartnerPromotionsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PromotionsContent />
    </Suspense>
  )
}
