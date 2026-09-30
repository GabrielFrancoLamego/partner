"use client"

import { createContext, useContext } from "react"
import type { Role } from "@prisma/client"

export type CompanyUser = {
  id: string
  name: string
  role: Role
  companyId: string
  companyName: string
  /** EMPLOYEE autorizado pelo Master/Gerente a registrar Ocorrências em modo CREATE_ONLY (sem ver histórico). */
  canRegisterOccurrences: boolean
  /** EMPLOYEE marcado como Responsável pelo Financeiro — acesso ao módulo mesmo sem o Role COMPANY_FINANCE. */
  isFinanceResponsible: boolean
}

const CompanyUserContext = createContext<CompanyUser | null>(null)

export function CompanyUserProvider({ user, children }: { user: CompanyUser; children: React.ReactNode }) {
  return <CompanyUserContext.Provider value={user}>{children}</CompanyUserContext.Provider>
}

/** Usuário logado em /company/** — sempre disponível dentro de CompanyShell. */
export function useCompanyUser() {
  const user = useContext(CompanyUserContext)
  if (!user) throw new Error("useCompanyUser deve ser usado dentro de /company (CompanyUserProvider)")
  return user
}
