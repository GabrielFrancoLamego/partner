import "server-only"
import { Prisma, type Role } from "@prisma/client"
import { getCurrentUser, type CurrentUser } from "./current-user"
import { isPlatformAdmin, isCompanyStaff, isPartner, canOperateFinance } from "./permissions"
import { prisma } from "./prisma"
import { getCompanyAccessState } from "./company-access"
import { isTwoFactorVerified } from "./two-factor-session"
import { enforceEmploymentAccessRules } from "./employment-access"

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
 *
 * Também repete o bloqueio individual de User.status — além de checar o
 * status já persistido, roda a regra de bloqueio automático do TEMPORARIO
 * (ver lib/employment-access.ts) a cada chamada, pra cortar o acesso de uma
 * sessão já aberta no mesmo instante em que o contrato vence, sem esperar o
 * próximo login.
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

  const wasBlocked = await enforceEmploymentAccessRules({
    id: user.id,
    companyId: user.companyId,
    role: user.role,
    status: user.status,
    employeeProfile: user.employeeProfile ? { employmentType: user.employeeProfile.employmentType, contractEndDate: user.employeeProfile.contractEndDate } : null,
  })
  if (wasBlocked || user.status !== "ACTIVE") {
    throw new ApiError(403, "Conta inativa — contate a Gerência/Master")
  }

  return user as CurrentUser & { companyId: string }
}

/**
 * Uso: rotas do Módulo Financeiro (/api/company/finance/**) — Master/Gerente/
 * Admin/COMPANY_FINANCE ou um EMPLOYEE marcado como Responsável pelo
 * Financeiro (ver lib/permissions.ts#canOperateFinance).
 */
export function requireFinanceAccess(user: CurrentUser) {
  if (!canOperateFinance(user)) throw new ApiError(403, "Sem permissão para esta ação")
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

/**
 * Uso: rotas do Módulo Financeiro (/api/company/finance/**). Staff da empresa
 * (Master/Gerente/Financeiro) opera a PRÓPRIA empresa; o ADMIN da plataforma
 * audita/opera qualquer empresa informando `?companyId=` — assim o painel
 * global usa exatamente as mesmas regras e telas do módulo da empresa.
 */
export async function requireFinanceContext(request: Request): Promise<{ user: CurrentUser; companyId: string }> {
  const user = await requireUser()
  if (user.role === "ADMIN") {
    const companyId = new URL(request.url).searchParams.get("companyId")
    if (!companyId || companyId === "all") throw new ApiError(400, "Selecione a empresa")
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })
    if (!company) throw new ApiError(404, "Empresa não encontrada")
    return { user, companyId }
  }
  const staff = await requireCompanyStaff()
  requireFinanceAccess(staff)
  return { user: staff, companyId: staff.companyId }
}
