"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ProgramsTab } from "@/components/admin/operacoes/programs-tab"
import { PromotionsTab } from "@/components/admin/operacoes/promotions-tab"
import { ChecklistsTab } from "@/components/admin/operacoes/checklists-tab"

export default function AdminOperacoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programas, Promoções & Checklists</h1>
        <p className="text-gray-600 mt-1 text-sm">Visão unificada de todas as empresas do grupo</p>
      </div>

      <Tabs defaultValue="programs">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="programs">Programas</TabsTrigger>
          <TabsTrigger value="promotions">Promoções</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
          <TabsContent value="programs">
            <ProgramsTab />
          </TabsContent>
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
