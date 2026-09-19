import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"
import {
  archiveProgram,
  pauseProgramForNewMembers,
  reactivateProgram,
  recordProgramChangeIfNeeded,
} from "@/lib/program-lifecycle"
import { deriveCommissionType } from "@/lib/commission-format"

const VALID_STATUSES = ["ACTIVE", "PAUSED_FOR_NEW_MEMBERS", "ARCHIVED"] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
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
      active,
      status,
    } = body

    if (status !== undefined && !VALID_STATUSES.includes(status)) throw new ApiError(400, "Status inválido")

    const before = await prisma.program.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, "Programa não encontrado")

    // Tipo de comissão é sempre derivado do formato + valor fixo extra
    // efetivos após esta atualização (ver lib/commission-format.ts) — nunca
    // um segundo seletor independente vindo do cliente.
    const effectiveFormat = commissionFormat ?? before.commissionFormat
    const effectiveHasFixed = fixedValue !== undefined ? Boolean(fixedValue) : Boolean(before.fixedValue)
    const commissionType = deriveCommissionType(effectiveFormat, effectiveHasFixed)

    if (effectiveFormat === "PRODUCT_UNIT" && productUnitLabel !== undefined && !productUnitLabel) {
      throw new ApiError(400, "Informe o rótulo da unidade de produto (ex: 'diária grátis')")
    }
    if (commissionType === "BOTH" && !effectiveHasFixed) {
      throw new ApiError(400, "Informe o valor fixo adicional (comissão combinada)")
    }

    // Transições de status (Ativar/Pausar/Arquivar) têm efeitos colaterais
    // (notificação, contagem de 30 dias, encerramento de vínculos) — tratadas
    // à parte pelo mesmo motor usado pela empresa (ver lib/program-lifecycle.ts).
    // O Admin, diferente da empresa, pode arquivar direto (sem passar por pausa).
    if (status !== undefined && status !== before.status) {
      if (status === "PAUSED_FOR_NEW_MEMBERS") await pauseProgramForNewMembers(before, admin.id)
      else if (status === "ARCHIVED") await archiveProgram(id)
      else if (status === "ACTIVE") await reactivateProgram(id)
    }

    const hasFieldUpdates =
      name !== undefined ||
      description !== undefined ||
      commissionValue !== undefined ||
      commissionFormat !== undefined ||
      fixedValue !== undefined ||
      imageUrl !== undefined ||
      pdfUrl !== undefined ||
      videoUrl !== undefined ||
      termsContent !== undefined ||
      active !== undefined

    let program = await prisma.program.findUniqueOrThrow({ where: { id } })

    if (hasFieldUpdates) {
      const db = auditedClient({ userId: admin.id, role: admin.role, companyId: before.companyId })
      program = await db.program.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(commissionValue !== undefined ? { commissionValue } : {}),
          ...(commissionFormat !== undefined || fixedValue !== undefined ? { commissionType, fixedValue: commissionType === "BOTH" ? fixedValue : null } : {}),
          ...(commissionFormat !== undefined ? { commissionFormat } : {}),
          ...(productUnitLabel !== undefined ? { productUnitLabel: effectiveFormat === "PRODUCT_UNIT" ? productUnitLabel : null } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(pdfUrl !== undefined ? { pdfUrl } : {}),
          ...(videoUrl !== undefined ? { videoUrl } : {}),
          ...(termsContent !== undefined ? { termsContent } : {}),
          // `active` só é aceito quando não veio `status` nesta mesma chamada —
          // status é sempre a fonte da verdade (ver sincronia em lib/program-lifecycle.ts).
          ...(active !== undefined && status === undefined ? { active } : {}),
        },
      })
      await recordProgramChangeIfNeeded(before, program, admin.id)
    }

    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}

/** "Excluir" arquiva logicamente (nunca apaga histórico) — mesmo padrão de DELETE /api/admin/companies/[id]. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin()
    const { id } = await params

    const existing = await prisma.program.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Programa não encontrado")

    await archiveProgram(id)
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
