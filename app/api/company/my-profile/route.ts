import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, handleApiError, ApiError } from "@/lib/api-auth"
import { isValidCpf, isValidCep } from "@/lib/validators"

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

// Banco/Agência/Conta só são obrigatórios quando o colaborador NÃO informa
// Chave PIX — com PIX preenchido, o pagamento pode ser feito só por ela.
const Schema = z
  .object({
    fullName: z.string().trim().min(1, "Informe o nome completo"),
    cpf: z.string().trim().refine(isValidCpf, "CPF inválido"),
    birthDate: z.string().trim().min(1, "Informe a data de nascimento"),
    personalPhone: z.string().trim().min(1, "Informe o telefone"),
    street: z.string().trim().min(1, "Informe a rua"),
    number: z.string().trim().min(1, "Informe o número"),
    neighborhood: z.string().trim().min(1, "Informe o bairro"),
    city: z.string().trim().min(1, "Informe a cidade"),
    state: z.string().trim().min(1, "Informe o estado"),
    zipCode: z.string().trim().refine(isValidCep, "CEP inválido"),
    pixKey: z.string().trim().default(""),
    bankName: z.string().trim().default(""),
    accountType: z.string().trim().default(""),
    agency: z.string().trim().default(""),
    accountNumber: z.string().trim().default(""),
  })
  .superRefine((data, ctx) => {
    const hasPix = data.pixKey.length > 0
    if (!hasPix) {
      if (!data.bankName) ctx.addIssue({ code: "custom", path: ["bankName"], message: "Informe o Banco ou a Chave PIX" })
      if (!data.agency) ctx.addIssue({ code: "custom", path: ["agency"], message: "Informe a Agência ou a Chave PIX" })
      if (!data.accountNumber)
        ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "Informe a Conta ou a Chave PIX" })
    }
    if (data.agency && !/^\d+$/.test(data.agency)) {
      ctx.addIssue({ code: "custom", path: ["agency"], message: "Agência deve conter apenas números" })
    }
    if (data.accountNumber && !/^\d+-?\d?$/.test(data.accountNumber)) {
      ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "Conta deve conter apenas números (dígito verificador opcional)" })
    }
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
