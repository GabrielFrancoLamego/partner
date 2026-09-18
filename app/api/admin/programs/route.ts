import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { auditedClient } from "@/lib/audit"
import { sweepPauseExpirations } from "@/lib/program-lifecycle"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    await sweepPauseExpirations()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    const programs = await prisma.program.findMany({
      where: companyId && companyId !== "all" ? { companyId } : {},
      include: {
        company: { select: { id: true, name: true, city: true } },
        levels: { orderBy: { order: "asc" } },
        _count: { select: { referrals: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(programs)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { companyId, name, description, commissionType, commissionValue, commissionFormat, fixedValue, productUnitLabel, imageUrl, pdfUrl, videoUrl, termsContent } = body

    if (!companyId || !name || !commissionType || commissionValue === undefined) {
      throw new ApiError(400, "Empresa, nome, tipo e valor de comissão são obrigatórios")
    }
    if (commissionFormat === "PRODUCT_UNIT" && !productUnitLabel) {
      throw new ApiError(400, "Informe o rótulo da unidade de produto (ex: 'diária grátis')")
    }
    if (commissionType === "BOTH" && !fixedValue) {
      throw new ApiError(400, "Informe o valor fixo adicional (comissão 'Ambas')")
    }

    const db = auditedClient({ userId: admin.id, role: admin.role, companyId })
    const program = await db.program.create({
      data: {
        companyId,
        name,
        description: description ?? "",
        commissionType,
        commissionValue,
        commissionFormat: commissionFormat ?? "PERCENTAGE",
        fixedValue: commissionType === "BOTH" ? fixedValue : null,
        productUnitLabel: commissionFormat === "PRODUCT_UNIT" ? productUnitLabel : null,
        imageUrl,
        pdfUrl,
        videoUrl,
        termsContent,
      },
    })

    return Response.json(program, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
