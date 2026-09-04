import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const { active } = await request.json()

    const link = await prisma.publicRegistrationLink.update({
      where: { id },
      data: { active },
    })

    return Response.json(link)
  } catch (error) {
    return handleApiError(error)
  }
}
