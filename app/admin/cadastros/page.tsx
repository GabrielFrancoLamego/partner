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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="links">Links de Cadastro</TabsTrigger>
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="approvals">Aprovações Pendentes</TabsTrigger>
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
