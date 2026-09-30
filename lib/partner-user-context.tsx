"use client"

import { createContext, useContext } from "react"

export type PartnerUser = { id: string; name: string; isAffiliate: boolean; photoUrl: string | null }

const PartnerUserContext = createContext<PartnerUser | null>(null)

export function PartnerUserProvider({ user, children }: { user: PartnerUser; children: React.ReactNode }) {
  return <PartnerUserContext.Provider value={user}>{children}</PartnerUserContext.Provider>
}

/** Usuário logado em /partner/** — sempre disponível dentro de PartnerShell. */
export function usePartnerUser() {
  const user = useContext(PartnerUserContext)
  if (!user) throw new Error("usePartnerUser deve ser usado dentro de /partner (PartnerUserProvider)")
  return user
}
