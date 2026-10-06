import type { Role } from "@prisma/client"

/** Papéis que pertencem ao time interno de uma empresa (multi-tenant). */
export const COMPANY_STAFF_ROLES: Role[] = ["COMPANY_MASTER", "COMPANY_GERENTE", "COMPANY_FINANCE", "EMPLOYEE"]

/** Papéis cujas ações de escrita são gravadas em AuditLog (ADMIN + staff de empresa). */
export const AUDITED_ROLES: Role[] = ["ADMIN", "COMPANY_MASTER", "COMPANY_GERENTE", "COMPANY_FINANCE"]

export function isPlatformAdmin(role: Role) {
  return role === "ADMIN"
}

export function isCompanyStaff(role: Role) {
  return COMPANY_STAFF_ROLES.includes(role)
}

export function shouldAudit(role: Role) {
  return AUDITED_ROLES.includes(role)
}

/** Acesso exclusivo ao painel central de Logs de Auditoria. */
export function canAccessAuditLog(role: Role) {
  return role === "ADMIN"
}

/** Alterar/excluir/incluir cadastros e parâmetros globais da plataforma. */
export function canManagePlatform(role: Role) {
  return role === "ADMIN"
}

/** Criar/gerenciar Gerentes, Financeiros e Operadores da própria empresa. */
export function canManageCompanyUsers(role: Role) {
  return role === "ADMIN" || role === "COMPANY_MASTER"
}

/** Configurar programas de parceria e ver relatórios consolidados da empresa. */
export function canConfigureCompany(role: Role) {
  return role === "ADMIN" || role === "COMPANY_MASTER"
}

/** Ponto digital com GPS, checklists com foto, mural de novidades, advertências/gamificação. */
export function canManageDailyOperations(role: Role) {
  return role === "ADMIN" || role === "COMPANY_MASTER" || role === "COMPANY_GERENTE"
}

/** Saques via PIX, aprovação de comissões, upload de comprovantes bancários. */
export function canManageFinance(role: Role) {
  return role === "ADMIN" || role === "COMPANY_MASTER" || role === "COMPANY_FINANCE"
}

/** Cumprir checklists, escanear QR Codes no PDV. */
export function canOperateFrontDesk(role: Role) {
  return role === "EMPLOYEE" || role === "COMPANY_GERENTE" || role === "COMPANY_MASTER"
}

/** Bater ponto no GPS — Colaborador e Gerente (quando tiverem horário configurado pelo Master); Master não registra ponto próprio. */
export function canPunchTimeclock(role: Role) {
  return role === "EMPLOYEE" || role === "COMPANY_GERENTE"
}

/** Master da empresa (ou Admin da plataforma) — ações exclusivas que nem a Gerente tem: editar um Fechamento já COMPLETED, ver o histórico de dias já fechados, moderar (ocultar/excluir) qualquer post do Mural, etc. */
export function isCompanyMasterOrAdmin(role: Role) {
  return role === "ADMIN" || role === "COMPANY_MASTER"
}

/** Editar um Fechamento de Expediente já COMPLETED, ou revisar o histórico de dias já fechados — exclusivo do Master. */
export const canReviewCompletedShiftClosings = isCompanyMasterOrAdmin

export function isPartner(role: Role) {
  return role === "PARTNER"
}

/**
 * Acesso ao Módulo Financeiro unificado (/company/financeiro) — Master/Admin/
 * COMPANY_FINANCE por papel, OU um Colaborador marcado com a flag
 * `responsavelFinanceiro` (EmployeeProfile.isFinanceResponsible). Esse
 * Colaborador mantém acesso integral às telas normais de Colaborador
 * (Dashboard, Checklists, Ponto, Mural, Crescimento, Ocorrências das
 * próprias) E ganha o módulo Financeiro — não troca de papel na plataforma.
 */
export function canAccessFinanceModule(user: { role: Role; employeeProfile?: { isFinanceResponsible: boolean } | null }) {
  return canManageFinance(user.role) || Boolean(user.employeeProfile?.isFinanceResponsible)
}

/**
 * Quem opera o módulo Financeiro (/company/financeiro): Master/Gerente/Admin
 * (operação diária) E quem acessa o módulo por papel ou pela flag
 * `responsavelFinanceiro` — aprovar/reprovar saques, quitar contas, lançar o
 * valor de comissões, ver recebíveis e exportar relatórios.
 */
export function canOperateFinance(user: { role: Role; employeeProfile?: { isFinanceResponsible: boolean } | null }) {
  return canManageDailyOperations(user.role) || canAccessFinanceModule(user)
}

/** Lançar/ver todas as Ocorrências e dar baixa em pagamentos — Master/Gerente/Admin (operação diária) OU quem acessa o Módulo Financeiro (papel COMPANY_FINANCE ou Colaborador com responsavelFinanceiro). Editar/excluir um lançamento já existente continua exclusivo de Gerente/Master/Admin (ver app/api/company/occurrences/[id]/route.ts). */
export function canManageOccurrences(user: { role: Role; employeeProfile?: { isFinanceResponsible: boolean } | null }) {
  return canManageDailyOperations(user.role) || canAccessFinanceModule(user)
}
