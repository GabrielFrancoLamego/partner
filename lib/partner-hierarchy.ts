import { prisma } from "./prisma"

/**
 * Regra do Saldo: comissões geradas por indicações de colaboradores de uma
 * agência (PartnerProfile.parentId) são creditadas na conta do parceiro
 * principal (a agência), não na do colaborador que gerou a indicação.
 *
 * Sobe a árvore parentId até a raiz (a própria agência, ou o parceiro
 * individual se ele não tiver pai) e retorna quem deve receber o crédito.
 */
export async function resolveBillingPartner(partnerProfileId: string) {
  let current = await prisma.partnerProfile.findUniqueOrThrow({
    where: { id: partnerProfileId },
    select: { id: true, parentId: true, userId: true, partnerType: true },
  })

  while (current.parentId) {
    current = await prisma.partnerProfile.findUniqueOrThrow({
      where: { id: current.parentId },
      select: { id: true, parentId: true, userId: true, partnerType: true },
    })
  }

  return current
}
