"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PromotionsTab } from "@/components/admin/operacoes/promotions-tab"
import { ChecklistsTab } from "@/components/admin/operacoes/checklists-tab"

export default function AdminOperacoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Operações</h1>
        <p className="text-gray-600 mt-1 text-sm">Promoções e Checklists de todas as empresas do grupo</p>
      </div>

      <Tabs defaultValue="promotions">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="promotions">Promoções</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
          <TabsContent value="promotions">
            <PromotionsTab />
          </TabsContent>
          <TabsContent value="checklists">
            <ChecklistsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
