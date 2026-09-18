import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { getCompanyWalletBalance, leaveProgramMembership } from "@/lib/program-lifecycle"

async function findOwnActiveMembership(partnerId: string, programId: string) {
  const membership = await prisma.programMembership.findUnique({
    where: { programId_partnerId: { programId, partnerId } },
  })
  if (!membership || membership.status !== "ACTIVE") throw new ApiError(404, "Você não participa deste programa")
  return membership
}

/** Prévia do saldo em risco — alimenta o texto do Modal de Confirmação de saída (task 3). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    const { id } = await params
    const membership = await findOwnActiveMembership(user.id, id)
    const pendingBalance = await getCompanyWalletBalance(user.id, membership.companyId)
    return Response.json({ pendingBalance: Math.max(0, pendingBalance) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Confirmação de "Sair do Programa" — saldo pendente NESTA empresa é perdido (ver lib/program-lifecycle.ts). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePartner()
    const { id } = await params
    const membership = await findOwnActiveMembership(user.id, id)
    const forfeited = await leaveProgramMembership(membership, "LEFT_BY_PARTNER")
    return Response.json({ ok: true, forfeitedBalance: forfeited })
  } catch (error) {
    return handleApiError(error)
  }
}
