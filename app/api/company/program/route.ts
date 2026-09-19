import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canConfigureCompany } from "@/lib/permissions"
import { auditedClient } from "@/lib/audit"
import { pauseProgramForNewMembers, reactivateProgram, recordProgramChangeIfNeeded, sweepPauseExpirations } from "@/lib/program-lifecycle"
import { deriveCommissionType } from "@/lib/commission-format"

/** Programa de Parceria da própria empresa (1:1 com Company) — Master configura sem depender do Admin da plataforma. */
export async function GET() {
  try {
    const user = await requireCompanyStaff()
    await sweepPauseExpirations()
    const program = await prisma.program.findUnique({ where: { companyId: user.companyId } })
    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Pausar/Retomar — a empresa NÃO PODE cancelar/arquivar o programa
 * diretamente (só o Admin, ver /api/admin/programs/[id]): pausar fecha para
 * novas adesões e avisa quem já está vinculado com 30 dias de acesso total
 * garantido; o encerramento definitivo acontece sozinho depois disso (ver
 * lib/program-lifecycle.ts#sweepPauseExpirations).
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canConfigureCompany)
    const companyId = user.companyId

    const { status } = await request.json()
    if (status !== "PAUSED_FOR_NEW_MEMBERS" && status !== "ACTIVE") {
      throw new ApiError(400, "Empresas só podem Pausar ou Retomar — arquivamento é feito pelo Admin da plataforma")
    }

    const existing = await prisma.program.findUnique({ where: { companyId } })
    if (!existing) throw new ApiError(404, "Nenhum programa configurado ainda")
    if (existing.status === "ARCHIVED") throw new ApiError(400, "Programa arquivado pelo Admin — não pode ser reaberto por aqui")

    const program =
      status === "PAUSED_FOR_NEW_MEMBERS" ? await pauseProgramForNewMembers(existing, user.id) : await reactivateProgram(existing.id)

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
      commissionValue,
      commissionFormat,
      fixedValue,
      productUnitLabel,
      imageUrl,
      pdfUrl,
      videoUrl,
      termsContent,
      validFrom,
      validUntil,
    } = body

    if (!name || commissionValue === undefined) {
      throw new ApiError(400, "Nome e valor de comissão são obrigatórios")
    }
    const format = commissionFormat ?? "PERCENTAGE"
    if (format === "PRODUCT_UNIT" && !productUnitLabel) {
      throw new ApiError(400, "Informe o rótulo da unidade de produto (ex: 'diária grátis')")
    }
    // Tipo de comissão é derivado do formato + valor fixo extra — nunca mais
    // um segundo seletor independente (ver lib/commission-format.ts).
    const commissionType = deriveCommissionType(format, Boolean(fixedValue))
    if (commissionType === "BOTH" && !fixedValue) {
      throw new ApiError(400, "Informe o valor fixo adicional (comissão combinada)")
    }

    const before = await prisma.program.findUnique({ where: { companyId } })
    if (before?.status === "ARCHIVED") throw new ApiError(400, "Programa arquivado pelo Admin — não pode ser editado")

    // `status`/`active` nunca vêm deste formulário — pausa/retomada é sempre
    // via PATCH (ver lib/program-lifecycle.ts), preservando o status atual aqui.
    const data = {
      name,
      description: description ?? "",
      commissionType,
      commissionValue,
      commissionFormat: format,
      fixedValue: commissionType === "BOTH" ? fixedValue : null,
      productUnitLabel: format === "PRODUCT_UNIT" ? productUnitLabel : null,
      imageUrl: imageUrl || null,
      pdfUrl: pdfUrl || null,
      videoUrl: videoUrl || null,
      termsContent: termsContent || null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    }

    const db = auditedClient({ userId: user.id, role: user.role, companyId })
    const program = await db.program.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data },
    })

    if (before) await recordProgramChangeIfNeeded(before, program, user.id)

    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}
