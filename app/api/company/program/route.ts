import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { auditedClient } from "@/lib/audit"

/** Programa de Parceria da própria empresa (1:1 com Company) — Master configura sem depender do Admin da plataforma. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    const program = await prisma.program.findUnique({ where: { companyId: user.companyId } })
    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Toggle rápido de ativo/inativo — não exige reenviar o formulário inteiro. */
export async function PATCH(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const companyId = user.companyId

    const { active } = await request.json()
    if (typeof active !== "boolean") throw new ApiError(400, "Campo 'active' obrigatório")

    const existing = await prisma.program.findUnique({ where: { companyId } })
    if (!existing) throw new ApiError(404, "Nenhum programa configurado ainda")

    const db = auditedClient({ userId: user.id, role: user.role, companyId })
    const program = await db.program.update({ where: { companyId }, data: { active } })

    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const companyId = user.companyId

    const body = await request.json()
    const {
      name,
      description,
      commissionType,
      commissionValue,
      commissionFormat,
      productUnitLabel,
      imageUrl,
      pdfUrl,
      videoUrl,
      termsContent,
      validFrom,
      validUntil,
      active,
    } = body

    if (!name || !commissionType || commissionValue === undefined) {
      throw new ApiError(400, "Nome, tipo e valor de comissão são obrigatórios")
    }
    if (commissionFormat === "PRODUCT_UNIT" && !productUnitLabel) {
      throw new ApiError(400, "Informe o rótulo da unidade de produto (ex: 'diária grátis')")
    }

    const data = {
      name,
      description: description ?? "",
      commissionType,
      commissionValue,
      commissionFormat: commissionFormat ?? "PERCENTAGE",
      productUnitLabel: commissionFormat === "PRODUCT_UNIT" ? productUnitLabel : null,
      imageUrl: imageUrl || null,
      pdfUrl: pdfUrl || null,
      videoUrl: videoUrl || null,
      termsContent: termsContent || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      ...(active !== undefined ? { active } : {}),
    }

    const db = auditedClient({ userId: user.id, role: user.role, companyId })
    const program = await db.program.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data },
    })

    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}
