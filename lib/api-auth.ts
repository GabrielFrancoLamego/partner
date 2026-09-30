import "server-only"
import { Prisma, type Role } from "@prisma/client"
import { getCurrentUser, type CurrentUser } from "./current-user"
import { isPlatformAdmin, isCompanyStaff, isPartner, canAccessFinanceModule } from "./permissions"
import { prisma } from "./prisma"
import { getCompanyAccessState } from "./company-access"
import { isTwoFactorVerified } from "./two-factor-session"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Lança 401 se não houver sessão + perfil configurado; senão devolve o User. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError(401, "Não autenticado")
  return user
}

/** Lança 403 se `check(user.role)` (de lib/permissions.ts) for falso. */
export function requireCapability(user: CurrentUser, check: (role: Role) => boolean) {
  if (!check(user.role)) throw new ApiError(403, "Sem permissão para esta ação")
}

/** Uso: toda rota sob app/api/admin/* — exige sessão + role ADMIN (plataforma). */
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  requireCapability(user, isPlatformAdmin)
  return user
}

/**
 * Uso: toda rota sob app/api/company/* — exige sessão + role de staff de
 * empresa (Master, Gerente, Financeiro ou Colaborador) com companyId
 * vinculado. Diferente do admin, essas rotas NUNCA aceitam companyId vindo
 * do cliente — o escopo é sempre `user.companyId` da própria sessão.
 *
 * Também repete aqui o mesmo bloqueio de acesso que app/company/layout.tsx
 * aplica na tela (empresa BLOCKED/ARCHIVED/INACTIVE ou OVERDUE além da
 * carência) — sem isso, o bloqueio era só visual: uma chamada direta à API
 * (curl/Postman) continuava funcionando normalmente para o staff de uma
 * empresa suspensa (ver lib/company-access.ts).
 */
export async function requireCompanyStaff(): Promise<CurrentUser & { companyId: string }> {
  const user = await requireUser()
  requireCapability(user, isCompanyStaff)
  if (!user.companyId) throw new ApiError(403, "Usuário sem empresa vinculada")

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { status: true, overdueSince: true },
  })
  if (!company) throw new ApiError(403, "Empresa não encontrada")
  if (getCompanyAccessState(company).kind === "BLOCKED") {
    throw new ApiError(403, "Acesso da empresa suspenso — contate o suporte Tribuss")
  }

  return user as CurrentUser & { companyId: string }
}

/**
 * Uso: rotas do Módulo Financeiro (/api/company/finance/**) — exige role de
 * finanças (Master/Admin/COMPANY_FINANCE) OU um EMPLOYEE marcado como
 * Responsável pelo Financeiro (ver lib/permissions.ts#canAccessFinanceModule).
 */
export function requireFinanceAccess(user: CurrentUser) {
  if (!canAccessFinanceModule(user)) throw new ApiError(403, "Sem permissão para esta ação")
}

/**
 * Uso: toda rota sob app/api/partner/* — exige sessão + role PARTNER.
 *
 * Quando o parceiro tem 2FA ativo (User.twoFactorEnabled), também exige o
 * cookie de "2FA verificado nesta sessão" (ver lib/two-factor-session.ts) —
 * antes, esse segundo fator só era checado em app/partner/layout.tsx (nível
 * de tela), então uma chamada direta à API com a sessão Supabase válida (só
 * senha) bypassava o 2FA inteiro, o que anula o propósito do segundo fator
 * justamente no cenário que ele existe para proteger (credencial vazada).
 */
export async function requirePartner(): Promise<CurrentUser> {
  const user = await requireUser()
  requireCapability(user, isPartner)
  if (user.twoFactorEnabled && !(await isTwoFactorVerified(user.id))) {
    throw new ApiError(401, "Verificação em duas etapas pendente")
  }
  return user
}

/** Uso: `catch (error) { return handleApiError(error) }` em toda rota. */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return Response.json({ error: "Registro não encontrado" }, { status: 404 })
    }
    if (error.code === "P2003") {
      return Response.json(
        { error: "Não é possível excluir: existem registros vinculados a este item" },
        { status: 409 },
      )
    }
    if (error.code === "P2002") {
      return Response.json({ error: "Já existe um registro com esse valor único" }, { status: 409 })
    }
  }

  console.error(error)
  return Response.json({ error: "Erro interno" }, { status: 500 })
}
