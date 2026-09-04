import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const isManager = canManageDailyOperations(user.role)

    const rewards = await prisma.rewardCatalogItem.findMany({
      where: { companyId: user.companyId, ...(isManager ? {} : { active: true }) },
      orderBy: { costXp: "asc" },
    })

    return Response.json(rewards)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const companyId = user.companyId

    const formData = await request.formData()
    const name = formData.get("name")
    const description = formData.get("description")
    const costXp = formData.get("costXp")
    const stock = formData.get("stock")
    const file = formData.get("file")

    if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "Nome é obrigatório")
    if (typeof costXp !== "string" || !costXp || Number.isNaN(Number(costXp))) {
      throw new ApiError(400, "Custo em XP é obrigatório")
    }

    const imageUrl = file instanceof File && file.size > 0 ? await uploadImage("rewards", file) : null

    const reward = await prisma.rewardCatalogItem.create({
      data: {
        companyId,
        name: name.trim(),
        description: typeof description === "string" && description ? description.trim() : null,
        costXp: Number(costXp),
        stock: typeof stock === "string" && stock ? Number(stock) : null,
        imageUrl,
      },
    })

    await logAudit({ userId: user.id, companyId, action: "CREATE", entity: "RewardCatalogItem", entityId: reward.id, details: { name } })

    return Response.json(reward, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
