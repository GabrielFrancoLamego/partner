import "server-only"
import { Prisma, type Role } from "@prisma/client"
import { getCurrentUser, type CurrentUser } from "./current-user"
import { isPlatformAdmin } from "./permissions"

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
