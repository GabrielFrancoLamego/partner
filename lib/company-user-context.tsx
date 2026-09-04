"use client"

import { createContext, useContext } from "react"
import type { Role } from "@prisma/client"

export type CompanyUser = {
  id: string
  name: string
  role: Role
  companyId: string
  companyName: string
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
