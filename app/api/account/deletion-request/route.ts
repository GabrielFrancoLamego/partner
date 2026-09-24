import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth"
import { notifyPlatformAdmins } from "@/lib/notifications"

/**
 * Botão obrigatório de exclusão de conta (Apple App Store Guideline 5.1.1(v)
 * + LGPD) — disponível para Parceiro (/partner/perfil) e Colaborador/Staff de
 * empresa (/company/perfil). Não apaga nada automaticamente: só registra o
 * pedido para um Admin analisar (ver notifyPlatformAdmins).
 */
export async function GET() {
  try {
    const user = await requireUser()
    const record = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { accountDeletionStatus: true, accountDeletionRequestedAt: true },
    })
    return Response.json(record)
  } catch (error) {
    return handleApiError(error)
  }
}

const Schema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const parsed = Schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) throw new ApiError(400, "Dados inválidos")

    const current = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { accountDeletionStatus: true },
    })
    if (current.accountDeletionStatus === "ACCOUNT_DELETION_REQUESTED") {
      throw new ApiError(409, "Você já tem uma solicitação de exclusão em análise")
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        accountDeletionStatus: "ACCOUNT_DELETION_REQUESTED",
        accountDeletionRequestedAt: new Date(),
        accountDeletionReason: parsed.data.reason || null,
      },
      select: { accountDeletionStatus: true, accountDeletionRequestedAt: true },
    })

    await notifyPlatformAdmins({
      type: "ACCOUNT_DELETION_REQUESTED",
      title: "Solicitação de exclusão de conta",
      message: `${user.name} (${user.email}) solicitou a exclusão da própria conta.${
        parsed.data.reason ? ` Motivo: ${parsed.data.reason}` : ""
      }`,
      linkUrl: "/admin/cadastros",
    })

    return Response.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
