import { prisma } from "@/lib/prisma"
import { requirePartner, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

/**
 * Programa de Parceiros mais recente (parceiro não tem 1 empresa fixa — usa
 * o programa de qualquer empresa onde já tem comissão; sem histórico ainda,
 * cai no primeiro programa existente na plataforma) + se já aceitou o termo.
 */
export async function GET() {
  try {
    const user = await requirePartner()

    const commission = await prisma.commission.findFirst({ where: { partnerId: user.id }, select: { companyId: true }, orderBy: { date: "desc" } })
    const program = await prisma.program.findFirst({
      where: commission ? { companyId: commission.companyId } : {},
      orderBy: { createdAt: "asc" },
    })
    if (!program || !program.termsContent) return Response.json({ program, accepted: true })

    const acceptance = await prisma.partnerTermAcceptance.findUnique({
      where: { partnerId_programId: { partnerId: user.id, programId: program.id } },
    })

    return Response.json({ program, accepted: !!acceptance })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePartner()

    const body = await request.json().catch(() => ({}))
    const programId = body?.programId as string | undefined
    const program = programId
      ? await prisma.program.findUnique({ where: { id: programId } })
      : await prisma.program.findFirst({ orderBy: { createdAt: "asc" } })
    if (!program) throw new ApiError(404, "Programa de Parceiros não encontrado")

    const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null

    const acceptance = await prisma.partnerTermAcceptance.upsert({
      where: { partnerId_programId: { partnerId: user.id, programId: program.id } },
      update: {},
      create: { partnerId: user.id, programId: program.id, ipAddress },
    })

    await logAudit({ userId: user.id, action: "CREATE", entity: "PartnerTermAcceptance", entityId: acceptance.id, ipAddress })

    return Response.json(acceptance, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
