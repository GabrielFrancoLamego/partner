import { Prisma, type Role } from "@prisma/client"
import { prisma } from "./prisma"
import { shouldAudit } from "./permissions"

/** Modelos sensíveis o suficiente para exigir trilha de auditoria. */
const AUDITED_MODELS = new Set([
  "User",
  "Company",
  "License",
  "Program",
  "ProgramLevel",
  "Promotion",
  "Unit",
  "Withdrawal",
  "Commission",
  "Referral",
  "WalletTransaction",
  "ChecklistTemplate",
  "Affiliate",
])

const WRITE_OPERATIONS = new Set(["create", "update", "updateMany", "delete", "deleteMany", "upsert"])

type Actor = {
  userId: string
  role: Role
  companyId?: string | null
  ipAddress?: string | null
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  // Remove valores não serializáveis (Decimal, Date, etc viram string/number via toJSON)
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * Retorna um Prisma Client "com contexto de ator" que grava AuditLog automaticamente
 * para toda escrita (create/update/delete/upsert) em modelos sensíveis — mas apenas
 * quando o ator é ADMIN ou staff de empresa (Master, Gerente, Financeiro), conforme
 * a regra de negócio. Para PARTNER/EMPLOYEE, retorna o client normal sem overhead.
 *
 * Uso (dentro de uma rota/server action já autenticada):
 *   const db = auditedClient({ userId, role, companyId })
 *   await db.withdrawal.update(...) // AuditLog gravado automaticamente
 */
export function auditedClient(actor: Actor) {
  if (!shouldAudit(actor.role)) return prisma

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args)

          if (model && AUDITED_MODELS.has(model) && WRITE_OPERATIONS.has(operation)) {
            const entityId =
              typeof result === "object" && result !== null && "id" in result
                ? String((result as { id: unknown }).id)
                : null

            await prisma.auditLog.create({
              data: {
                userId: actor.userId,
                companyId: actor.companyId ?? null,
                action: operation.toUpperCase(),
                entity: model,
                entityId,
                details: toJson(args) ?? Prisma.JsonNull,
                ipAddress: actor.ipAddress ?? null,
              },
            })
          }

          return result
        },
      },
    },
  })
}

/**
 * Registro explícito para ações críticas que não mapeiam 1:1 para uma
 * escrita de modelo (ex: PIX_APPROVAL, CHECKIN_OVERRIDE, LOGIN_AS).
 */
export async function logAudit(entry: {
  userId: string
  companyId?: string | null
  action: string
  entity: string
  entityId?: string | null
  details?: unknown
  ipAddress?: string | null
}) {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      companyId: entry.companyId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      details: toJson(entry.details) ?? Prisma.JsonNull,
      ipAddress: entry.ipAddress ?? null,
    },
  })
}
