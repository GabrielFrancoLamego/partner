import type { GoalPeriod, GoalScope } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations, canConfigureCompany } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"

const SCOPES: GoalScope[] = ["COMPANY", "SECTOR", "EMPLOYEE"]
const PERIODS: GoalPeriod[] = ["DAILY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]

/** Lista de metas visível ao papel do usuário: Master/Gerente veem tudo; Colaborador só o que se aplica a ele. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const companyId = user.companyId
    const isManager = canManageDailyOperations(user.role)

    let where: Record<string, unknown> = { companyId }
    if (!isManager) {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id }, select: { sectorId: true } })
      where = {
        companyId,
        OR: [{ scope: "COMPANY" }, { scope: "EMPLOYEE", employeeId: user.id }, ...(profile?.sectorId ? [{ scope: "SECTOR", sectorId: profile.sectorId }] : [])],
      }
    }

    const goals = await prisma.goal.findMany({
      where,
      include: {
        tiers: { orderBy: { order: "asc" } },
        sector: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(goals)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Criar meta — exclusivo do Master; a Gerente só visualiza e reporta o resultado diário (ver [id]/records). */
export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const companyId = user.companyId

    const body = await request.json()
    const { scope, sectorId, employeeId, period, name, tiers } = body as {
      scope: GoalScope
      sectorId?: string
      employeeId?: string
      period: GoalPeriod
      name: string
      tiers?: {
        targetAmount: number
        bonusAmount: number
        rewardType?: "CASH" | "PHYSICAL_REWARD"
        rewardCatalogItemId?: string | null
        rewardLabel?: string | null
      }[]
    }

    if (!SCOPES.includes(scope)) throw new ApiError(400, "Escopo inválido")
    if (!PERIODS.includes(period)) throw new ApiError(400, "Período inválido")
    if (!name?.trim()) throw new ApiError(400, "Nome da meta é obrigatório")
    if (scope === "SECTOR" && !sectorId) throw new ApiError(400, "Selecione o setor")
    if (scope === "EMPLOYEE" && !employeeId) throw new ApiError(400, "Selecione o colaborador")

    if (sectorId) {
      const sector = await prisma.sector.findFirst({ where: { id: sectorId, companyId } })
      if (!sector) throw new ApiError(404, "Setor não encontrado nesta empresa")
    }
    if (employeeId) {
      const employee = await prisma.user.findFirst({ where: { id: employeeId, companyId } })
      if (!employee) throw new ApiError(404, "Colaborador não encontrado nesta empresa")
    }

    const rewardItemIds = [...new Set((tiers ?? []).map((t) => t.rewardCatalogItemId).filter((id): id is string => Boolean(id)))]
    if (rewardItemIds.length > 0) {
      const count = await prisma.rewardCatalogItem.count({ where: { id: { in: rewardItemIds }, companyId } })
      if (count !== rewardItemIds.length) throw new ApiError(404, "Item da Loja de Prêmios não encontrado")
    }

    const goal = await prisma.goal.create({
      data: {
        companyId,
        scope,
        sectorId: scope === "SECTOR" ? sectorId : null,
        employeeId: scope === "EMPLOYEE" ? employeeId : null,
        period,
        name: name.trim(),
        createdById: user.id,
        tiers: {
          create: (tiers ?? []).map((t, index) => ({
            order: index,
            targetAmount: Number(t.targetAmount),
            bonusAmount: Number(t.bonusAmount) || 0,
            rewardType: t.rewardType === "PHYSICAL_REWARD" ? "PHYSICAL_REWARD" : "CASH",
            rewardCatalogItemId: t.rewardCatalogItemId || null,
            rewardLabel: t.rewardLabel || null,
          })),
        },
      },
      include: {
        tiers: { orderBy: { order: "asc" }, include: { rewardCatalogItem: { select: { id: true, name: true } } } },
        sector: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "Goal", entityId: goal.id, details: body })

    return Response.json(goal, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
