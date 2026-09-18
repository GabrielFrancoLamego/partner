import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"

/** Visão Geral (/admin/programas) — lista o Programa Interno de TODAS as empresas, uma linha por empresa que já configurou um. */
export async function GET() {
  try {
    await requirePlatformAdmin()

    const programs = await prisma.internalProgram.findMany({
      include: {
        company: { select: { id: true, name: true, city: true } },
        _count: { select: { levels: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(programs)
  } catch (error) {
    return handleApiError(error)
  }
}
