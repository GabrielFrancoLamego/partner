import { requirePartner, handleApiError } from "@/lib/api-auth"
import { acknowledgeProgramChange } from "@/lib/program-lifecycle"

/** Botão "Confirmar Aceite" na notificação de mudança de regras (task 3). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    const { id } = await params
    await acknowledgeProgramChange(user.id, id)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
