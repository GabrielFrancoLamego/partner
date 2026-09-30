import { prisma } from "@/lib/prisma"
import { requireUser, handleApiError, ApiError } from "@/lib/api-auth"
import { generateTotpSecret, buildTotpUri, verifyTotpCode } from "@/lib/totp"
import { markTwoFactorVerified, clearTwoFactorVerified } from "@/lib/two-factor-session"
import { generateQrDataUrl } from "@/lib/promotion-share"

/** Status atual do 2FA do usuário logado. */
export async function GET() {
  try {
    const user = await requireUser()
    return Response.json({ enabled: user.twoFactorEnabled })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Inicia o setup: gera um novo secret (ainda não ativo) e devolve a URI
 * `otpauth://` para o app autenticador escanear. Confirmar com o primeiro
 * código via PATCH é o que efetivamente liga o 2FA (evita ativar um secret
 * que o usuário nunca conseguiu escanear/sincronizar).
 */
export async function POST() {
  try {
    const user = await requireUser()
    const secret = generateTotpSecret()
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } })

    const otpauthUri = buildTotpUri(secret, user.email)
    const qrDataUrl = await generateQrDataUrl(otpauthUri)

    return Response.json({ secret, otpauthUri, qrDataUrl })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Confirma o setup (liga o 2FA) ou desativa — ambos exigem o código de 6 dígitos atual. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { code, action } = body as { code: string; action: "enable" | "disable" }

    if (!user.twoFactorSecret) throw new ApiError(400, "Inicie o setup do 2FA primeiro")
    if (!verifyTotpCode(user.twoFactorSecret, code ?? "")) throw new ApiError(400, "Código inválido ou expirado")

    if (action === "enable") {
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } })
      await markTwoFactorVerified(user.id)
      return Response.json({ enabled: true })
    }

    if (action === "disable") {
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } })
      await clearTwoFactorVerified()
      return Response.json({ enabled: false })
    }

    throw new ApiError(400, "Ação inválida")
  } catch (error) {
    return handleApiError(error)
  }
}
