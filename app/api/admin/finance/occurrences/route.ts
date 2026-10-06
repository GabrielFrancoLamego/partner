import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError } from "@/lib/api-auth"
import { OCCURRENCE_TYPE_LABELS } from "@/lib/finance-settlement"

/**
 * Auditoria global de ocorrências financeiras (Admin da plataforma): qualquer
 * empresa/colaborador, pendentes ou pagas, com forma de pagamento, quem quitou e
 * o comprovante. Filtros: ?companyId= (ou "all"), ?status=PENDING|PAID|all,
 * ?q= (nome do colaborador), ?from=&to= (data da ocorrência).
 */
export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")
    const q = searchParams.get("q")?.trim()
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const occurrences = await prisma.occurrence.findMany({
      where: {
        total: { not: null },
        ...(companyId && companyId !== "all" ? { companyId } : {}),
        ...(status === "PENDING" || status === "PAID" ? { paymentStatus: status } : {}),
        ...(q ? { OR: [{ employee: { name: { contains: q, mode: "insensitive" } } }, { employeeNameFreeText: { contains: q, mode: "insensitive" } }] } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
        customType: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    })

    return Response.json(
      occurrences.map((o) => ({
        id: o.id,
        company: o.company,
        employeeName: o.employee?.name ?? o.employeeNameFreeText ?? "—",
        typeLabel: o.type === "CUSTOM" ? (o.customType?.name ?? "Lançamento") : (OCCURRENCE_TYPE_LABELS[o.type] ?? o.type),
        description: o.description,
        total: Number(o.total),
        date: o.date,
        expectedPaymentDate: o.expectedPaymentDate,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        paidAt: o.paidAt,
        paidBy: o.paidBy,
        paymentProofUrl: o.paymentProofUrl,
        attachmentUrl: o.attachmentUrl,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
