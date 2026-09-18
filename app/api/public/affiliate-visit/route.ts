import { z } from "zod"
import { prisma } from "@/lib/prisma"

const Schema = z.object({ code: z.string().trim().min(1), target: z.enum(["COMPANY", "PARTNER"]) })

/**
 * Disparado (best-effort, "fire and forget") pelas páginas públicas
 * /join/partner e /join/company ao carregar com ?ref=CODE — métrica de topo
 * de funil do painel do Afiliado (ver /partner/afiliado), distinta de
 * conversão. Nunca falha visivelmente: link inválido só não conta a visita.
 */
export async function POST(request: Request) {
  try {
    const parsed = Schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return Response.json({ ok: true })

    const affiliate = await prisma.affiliate.findUnique({ where: { code: parsed.data.code }, select: { id: true } })
    if (affiliate) {
      await prisma.affiliateLinkVisit.create({ data: { affiliateId: affiliate.id, target: parsed.data.target } })
    }
  } catch {
    // best-effort — nunca quebra a página pública por causa de uma métrica
  }
  return Response.json({ ok: true })
}
