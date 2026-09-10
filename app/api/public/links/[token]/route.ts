import { prisma } from "@/lib/prisma"

/**
 * Resolve um token de PublicRegistrationLink para as páginas públicas de
 * cadastro (/join/**) — sem autenticação. Devolve só o necessário para
 * montar o formulário certo e barra o uso se o link estiver inativo ou
 * vencido (a submissão em si também revalida isso no POST).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const link = await prisma.publicRegistrationLink.findUnique({
    where: { token },
    include: { company: { select: { name: true, slug: true } }, sector: { select: { name: true } } },
  })

  if (!link) return Response.json({ error: "Link não encontrado" }, { status: 404 })

  const isExpired = !!link.expiresAt && link.expiresAt < new Date()
  const isValid = link.active && !isExpired

  return Response.json({
    valid: isValid,
    reason: !link.active ? "inactive" : isExpired ? "expired" : null,
    type: link.type,
    company: link.company,
    sector: link.sector,
    plan: link.plan,
  })
}
