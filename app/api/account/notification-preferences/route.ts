import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth"

/** Preferências de notificação (Header > Avatar > Preferências) — qualquer usuário autenticado, de qualquer role. */
export async function GET() {
  try {
    const user = await requireUser()
    return Response.json({
      notifyViaPush: user.notifyViaPush,
      notifyViaEmail: user.notifyViaEmail,
      notifyViaWhatsapp: user.notifyViaWhatsapp,
      soundOnEarnings: user.soundOnEarnings,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

const Schema = z.object({
  notifyViaPush: z.boolean().optional(),
  notifyViaEmail: z.boolean().optional(),
  notifyViaWhatsapp: z.boolean().optional(),
  soundOnEarnings: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "Preferências inválidas")

    const updated = await prisma.user.update({ where: { id: user.id }, data: parsed.data })

    return Response.json({
      notifyViaPush: updated.notifyViaPush,
      notifyViaEmail: updated.notifyViaEmail,
      notifyViaWhatsapp: updated.notifyViaWhatsapp,
      soundOnEarnings: updated.soundOnEarnings,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
