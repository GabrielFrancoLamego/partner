import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const {
      name,
      description,
      commissionType,
      commissionValue,
      commissionFormat,
      fixedValue,
      productUnitLabel,
      imageUrl,
      pdfUrl,
      videoUrl,
      termsContent,
      active,
    } = body

    if (commissionFormat === "PRODUCT_UNIT" && productUnitLabel !== undefined && !productUnitLabel) {
      throw new ApiError(400, "Informe o rótulo da unidade de produto (ex: 'diária grátis')")
    }
    if (commissionType === "BOTH" && fixedValue !== undefined && !fixedValue) {
      throw new ApiError(400, "Informe o valor fixo adicional (comissão 'Ambas')")
    }

    const existing = await prisma.program.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Programa não encontrado")

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId: existing.companyId })
    const program = await db.program.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(commissionType !== undefined ? { commissionType } : {}),
        ...(commissionValue !== undefined ? { commissionValue } : {}),
        ...(commissionFormat !== undefined ? { commissionFormat } : {}),
        ...(commissionType !== undefined ? { fixedValue: commissionType === "BOTH" ? fixedValue : null } : {}),
        ...(productUnitLabel !== undefined ? { productUnitLabel: commissionFormat === "PRODUCT_UNIT" ? productUnitLabel : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(pdfUrl !== undefined ? { pdfUrl } : {}),
        ...(videoUrl !== undefined ? { videoUrl } : {}),
        ...(termsContent !== undefined ? { termsContent } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    return Response.json(program)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin()
    const { id } = await params

    const existing = await prisma.program.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new ApiError(404, "Programa não encontrado")

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId: existing.companyId })
    await db.program.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
