import type { Role } from "@prisma/client"

export type MenuBucket = "admin" | "partner" | "colaborador"

/** Formato devolvido por /api/auth/login e /api/auth/me. */
export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  companyId: string | null
}

/**
 * Ponte temporária entre as 6 roles reais do banco e os 3 "buckets" visuais
 * que o menu lateral já usa (desktop-sidebar.tsx / mobile-bottom-nav.tsx).
 * Um refinamento fino de quem vê cada item (ex: Financeiro não ver
 * Programas) fica para uma tarefa separada — por ora ADMIN e todo o staff
 * de empresa (Master/Gerente/Financeiro) caem no bucket "admin".
 */
export function toMenuBucket(role: Role): MenuBucket {
  switch (role) {
    case "PARTNER":
      return "partner"
    case "EMPLOYEE":
      return "colaborador"
    default:
      return "admin"
  }
}
