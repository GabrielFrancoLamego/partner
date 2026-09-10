"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CompaniesTab } from "@/components/admin/cadastros/companies-tab"
import { PartnersTab } from "@/components/admin/cadastros/partners-tab"
import { UsersTab } from "@/components/admin/cadastros/users-tab"
import { ApprovalsTab } from "@/components/admin/cadastros/approvals-tab"
import { LinksTab } from "@/components/admin/cadastros/links-tab"
import { AffiliatesTab } from "@/components/admin/cadastros/affiliates-tab"

export default function AdminCadastrosPage() {
  return (
    <Suspense>
      <AdminCadastrosPageContent />
    </Suspense>
  )
}

function AdminCadastrosPageContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") ?? "companies"
  const planFilter = searchParams.get("plan")
  const conditionFilter = searchParams.get("condition") as "active" | "overdue" | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Cadastros & Aprovações</h1>
        <p className="text-gray-600 mt-1 text-sm">Empresas, parceiros, usuários e links de auto-cadastro</p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full h-auto justify-start gap-1 overflow-x-auto whitespace-nowrap bg-[#F1E9DC] p-1.5 rounded-xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[
            { value: "companies", label: "Empresas" },
            { value: "partners", label: "Parceiros" },
            { value: "users", label: "Usuários" },
            { value: "links", label: "Links de Cadastro" },
            { value: "affiliates", label: "Afiliados" },
            { value: "approvals", label: "Aprovações Pendentes" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-[#3E2415]/70 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F2680C] data-[state=active]:via-[#FB9C08] data-[state=active]:to-[#FFC800] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mt-4">
          <TabsContent value="companies">
            <CompaniesTab initialPlanFilter={planFilter} initialConditionFilter={conditionFilter} />
          </TabsContent>
          <TabsContent value="partners">
            <PartnersTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="links">
            <LinksTab />
          </TabsContent>
          <TabsContent value="affiliates">
            <AffiliatesTab />
          </TabsContent>
          <TabsContent value="approvals">
            <ApprovalsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
