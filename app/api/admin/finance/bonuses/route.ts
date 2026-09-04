import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const bonuses = await prisma.walletTransaction.findMany({
      where: {
        type: "MANUAL_CREDIT",
        partner: { role: "EMPLOYEE" },
        ...(companyId && companyId !== "all" ? { companyId } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true, employeeProfile: { select: { xpPoints: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return Response.json(bonuses)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { employeeId, amount, xp, description } = body

    if (!employeeId || !description) throw new ApiError(400, "Colaborador e descrição são obrigatórios")
    if (!amount && !xp) throw new ApiError(400, "Informe um valor em dinheiro e/ou pontos de XP")

    const employee = await prisma.user.findUnique({ where: { id: employeeId }, include: { employeeProfile: true } })
    if (!employee || employee.role !== "EMPLOYEE" || !employee.employeeProfile) {
      throw new ApiError(404, "Colaborador não encontrado")
    }

    const transaction = amount
      ? await prisma.walletTransaction.create({
          data: {
            companyId: employee.companyId!,
            partnerId: employeeId,
            type: "MANUAL_CREDIT",
            amount,
            description,
            createdById: admin.id,
          },
        })
      : null

    if (xp) {
      await prisma.employeeProfile.update({
        where: { userId: employeeId },
        data: { xpPoints: { increment: xp } },
      })
    }

    await logAudit({
      userId: admin.id,
      companyId: employee.companyId,
      action: "GRANT_BONUS",
      entity: "WalletTransaction",
      entityId: employeeId,
      details: { employeeId, amount, xp, description },
    })

    return Response.json({ ok: true, transaction }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
