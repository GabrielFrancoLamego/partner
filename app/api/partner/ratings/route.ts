import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { getPendingRatingCompanies, recomputeCompanyRating } from "@/lib/company-rating"

/** Empresas com programa ativo ainda não avaliadas pelo parceiro — modal de Avaliação Rápida (task 2). */
export async function GET() {
  try {
    const user = await requirePartner()
    const pending = await getPendingRatingCompanies(user.id)
    return Response.json(pending)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePartner()
    const { companyId, stars, comment } = await request.json()

    if (!companyId) throw new ApiError(400, "Empresa é obrigatória")
    const starsNumber = Number(stars)
    if (!Number.isInteger(starsNumber) || starsNumber < 1 || starsNumber > 5) throw new ApiError(400, "Nota deve ser de 1 a 5 estrelas")

    const rating = await prisma.companyRating.upsert({
      where: { companyId_partnerId: { companyId, partnerId: user.id } },
      update: { stars: starsNumber, comment: comment || null },
      create: { companyId, partnerId: user.id, stars: starsNumber, comment: comment || null },
    })

    await recomputeCompanyRating(companyId)

    return Response.json(rating, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
