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

/** Bater ponto, cumprir checklists, escanear QR Codes no PDV. */
export function canOperateFrontDesk(role: Role) {
  return role === "EMPLOYEE" || role === "COMPANY_GERENTE" || role === "COMPANY_MASTER"
}

export function isPartner(role: Role) {
  return role === "PARTNER"
}
