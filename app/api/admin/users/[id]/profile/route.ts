import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

const PROFILE_FIELDS = [
  "fullName",
  "nickname",
  "cpf",
  "rg",
  "rgIssuer",
  "birthDate",
  "gender",
  "maritalStatus",
  "voterCard",
  "militaryCertificate",
  "cnh",
  "cnhCategory",
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
  "zipCode",
  "personalPhone",
  "emergencyContactName",
  "emergencyContactPhone",
  "bankName",
  "accountType",
  "agency",
  "accountNumber",
  "pixKey",
  "cpfDocUrl",
  "rgDocUrl",
  "proofOfResidenceUrl",
  "photoUrl",
  "isProfileComplete",
] as const

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: id } })
    if (!profile) throw new ApiError(404, "Colaborador sem perfil de RH (não é EMPLOYEE)")

    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    for (const field of PROFILE_FIELDS) {
      if (body[field] === undefined) continue
      data[field] = field === "birthDate" && body[field] ? new Date(body[field]) : body[field] || null
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { companyId: true } })
    if (!user) throw new ApiError(404, "Usuário não encontrado")

    const profile = await prisma.employeeProfile.update({ where: { userId: id }, data })

    await logAudit({
      userId: admin.id,
      companyId: user.companyId,
      action: "UPDATE",
      entity: "EmployeeProfile",
      entityId: id,
      details: body,
    })

    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}
