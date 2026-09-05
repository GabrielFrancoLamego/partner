import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

/** Programa Interno da empresa + se o usuário logado já aceitou o termo (usado para decidir se o modal bloqueante aparece). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()

    const program = await prisma.internalProgram.findUnique({ where: { companyId: user.companyId } })
    if (!program || !program.termsContent) return Response.json({ program, accepted: true })

    const acceptance = await prisma.employeeTermAcceptance.findUnique({
      where: { employeeId_internalProgramId: { employeeId: user.id, internalProgramId: program.id } },
    })

    return Response.json({ program, accepted: !!acceptance })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanyStaff()

    const program = await prisma.internalProgram.findUnique({ where: { companyId: user.companyId } })
    if (!program) throw new ApiError(404, "Programa Interno não encontrado")

    const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null

    const acceptance = await prisma.employeeTermAcceptance.upsert({
      where: { employeeId_internalProgramId: { employeeId: user.id, internalProgramId: program.id } },
      update: {},
      create: { employeeId: user.id, internalProgramId: program.id, ipAddress },
    })

    await logAudit({ userId: user.id, companyId: user.companyId, action: "CREATE", entity: "EmployeeTermAcceptance", entityId: acceptance.id, ipAddress })

    return Response.json(acceptance, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
