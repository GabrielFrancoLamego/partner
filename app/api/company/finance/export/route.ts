import { handleApiError, ApiError, requireFinanceContext } from "@/lib/api-auth"
import { buildFinanceExport, parseExportTab, renderPdf, renderXlsx } from "@/lib/finance-export"

export const runtime = "nodejs"

/**
 * Exportação de relatório de qualquer sub-aba do Financeiro — gerada no
 * servidor, com os mesmos dados/filtros da tela. ?tab= contas-a-pagar |
 * comissoes-saques | recebiveis | quitacoes, ?format= xlsx | pdf, e os filtros
 * da aba (?month= em recebiveis; ?from=&to= em quitacoes — o período é
 * aplicado estritamente).
 */
export async function GET(request: Request) {
  try {
    const { user, companyId: scopeCompanyId } = await requireFinanceContext(request)

    const { searchParams } = new URL(request.url)
    const tab = parseExportTab(searchParams.get("tab"))
    const format = searchParams.get("format")
    if (format !== "xlsx" && format !== "pdf") throw new ApiError(400, "Formato inválido — use xlsx ou pdf")

    const report = await buildFinanceExport(scopeCompanyId, tab, {
      month: searchParams.get("month"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    })
    const stamp = new Date().toISOString().slice(0, 10)
    const body = format === "xlsx" ? await renderXlsx(report) : renderPdf(report)
    const contentType = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf"

    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${report.filename}-${stamp}.${format}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
