import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"

/** Auto-edição do próprio cadastro pelo Colaborador — formulário obrigatório de primeiro acesso (ver ProfileCompletionGate). */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, "Perfil não encontrado")
    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}

const Schema = z.object({
  fullName: z.string().trim().min(1),
  cpf: z.string().trim().min(1),
  birthDate: z.string().trim().min(1),
  personalPhone: z.string().trim().min(1),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  neighborhood: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zipCode: z.string().trim().min(1),
  pixKey: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  accountType: z.string().trim().min(1),
  agency: z.string().trim().min(1),
  accountNumber: z.string().trim().min(1),
})

export async function PATCH(request: Request) {
  try {
    const user = await requireCompanyStaff()
    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Preencha todos os campos obrigatórios")

    const profile = await prisma.employeeProfile.update({
      where: { userId: user.id },
      data: { ...parsed.data, birthDate: new Date(parsed.data.birthDate), isProfileComplete: true },
    })

    return Response.json(profile)
  } catch (error) {
    return handleApiError(error)
  }
}
