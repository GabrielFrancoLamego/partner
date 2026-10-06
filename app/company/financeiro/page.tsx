"use client"

import { Suspense } from "react"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canOperateFinance } from "@/lib/permissions"
import { FinanceModule } from "@/components/company/finance/finance-module"

export default function CompanyFinanceiroPage() {
  const user = useCompanyUser()
  const allowed = canOperateFinance({ role: user.role, employeeProfile: { isFinanceResponsible: user.isFinanceResponsible } })

  if (!allowed) {
    return <EmptyState message="Acesso restrito ao Master, Gerente e ao Responsável pelo Financeiro." />
  }

  return (
    <Suspense fallback={<LoadingState />}>
      <FinanceModule subtitle={`Contas a pagar, saques, comissões, recebíveis e quitações de ${user.companyName}`} />
    </Suspense>
  )
}
