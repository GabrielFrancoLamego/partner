import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"

export async function GET() {
  try {
    const user = await requirePartner()
    const profile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, "Perfil não encontrado")
    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}

const UpdateSchema = z.object({
  pixKey: z.string().trim().min(1).optional(),
  bankName: z.string().trim().min(1).optional(),
  accountType: z.string().trim().min(1).optional(),
  agency: z.string().trim().min(1).optional(),
  accountNumber: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1).optional(),
  whatsapp: z.string().trim().min(1).optional(),
})

/** Auto-edição do próprio cadastro pelo Parceiro — Dados Bancários/PIX exigidos antes do 1º saque (ver app/api/partner/withdrawals). */
export async function PATCH(request: Request) {
  try {
    const user = await requirePartner()
    const parsed = UpdateSchema.safeParse(await request.json())
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos")

    const profile = await prisma.partnerProfile.update({ where: { userId: user.id }, data: parsed.data })
    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}
