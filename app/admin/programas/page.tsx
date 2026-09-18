"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ProgramsTab } from "@/components/admin/operacoes/programs-tab"
import { InternalProgramsTab } from "@/components/admin/operacoes/internal-programs-tab"
import { OverviewTab } from "@/components/admin/programas/overview-tab"

export default function AdminProgramasPage() {
  const [tab, setTab] = useState("overview")
  const [internalCompanyId, setInternalCompanyId] = useState<string | null>(null)

  const handleManage = (target: { type: "PARTNER" | "INTERNAL"; companyId: string }) => {
    if (target.type === "INTERNAL") {
      setInternalCompanyId(target.companyId)
      setTab("internal")
    } else {
      setTab("partner")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Programas</h1>
        <p className="text-gray-600 mt-1 text-sm">Programa de Parceiros (comissionamento externo) e Programa Interno (pontuação/RH) de todas as empresas</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="partner">Programa de Parceiros</TabsTrigger>
          <TabsTrigger value="internal">Programa Interno</TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
          <TabsContent value="overview">
            <OverviewTab onManage={handleManage} />
          </TabsContent>
          <TabsContent value="partner">
            <ProgramsTab />
          </TabsContent>
          <TabsContent value="internal">
            <InternalProgramsTab initialCompanyId={internalCompanyId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
