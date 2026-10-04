import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"

/** Número do PIS/PASEP do próprio colaborador — campo isolado da seção "Documentos Pessoais" em /company/perfil. */
export async function PATCH(request: Request) {
  try {
    const user = await requireCompanyStaff()
    if (user.role !== "EMPLOYEE") throw new ApiError(403, "Sem permissão para esta ação")

    const body = await request.json()
    const { pis } = body as { pis?: string }

    const profile = await prisma.employeeProfile.update({
      where: { userId: user.id },
      data: { pis: pis?.trim() || null },
    })

    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}
