import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth"

/** Itens do menu marcados em destaque pelo próprio usuário (barra mobile) — qualquer role. */
export async function GET() {
  try {
    const user = await requireUser()
    return Response.json({ pinnedMobileNavItems: user.pinnedMobileNavItems })
  } catch (error) {
    return handleApiError(error)
  }
}

const Schema = z.object({ pinnedMobileNavItems: z.array(z.string()).max(5, "Escolha no máximo 5 itens") })

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Seleção inválida")

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { pinnedMobileNavItems: parsed.data.pinnedMobileNavItems },
    })

    return Response.json({ pinnedMobileNavItems: updated.pinnedMobileNavItems })
  } catch (error) {
    return handleApiError(error)
  }
}
