import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth"
import { verifyTotpCode } from "@/lib/totp"
import { markTwoFactorVerified } from "@/lib/two-factor-session"

/**
 * Segundo fator do login — chamado depois que a senha já foi validada pelo
 * Supabase (a sessão já existe nesse ponto). Só marca o cookie de "2FA
 * verificado" (ver lib/two-factor-session.ts), que os layouts protegidos
 * exigem antes de liberar qualquer tela quando o usuário tem 2FA ativo.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new ApiError(400, "2FA não está ativo para esta conta")
    }

    const { code } = await request.json()
    if (!verifyTotpCode(user.twoFactorSecret, code ?? "")) throw new ApiError(400, "Código inválido ou expirado")

    await markTwoFactorVerified(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
