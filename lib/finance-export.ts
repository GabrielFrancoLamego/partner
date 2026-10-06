import "server-only"
import ExcelJS from "exceljs"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { ApiError } from "./api-auth"
import { PAYMENT_METHOD_LABELS_PT } from "./finance-labels"
import { endOfToday } from "./finance-employee"
import { listPayables, listPendingCommissions, listReceivables, listSettlements, listWithdrawals } from "./finance-reports"

export type ExportCell = string | number | null | { text: string; link: string }
export type ExportColumn = { header: string; key: string; kind?: "text" | "currency" }
export type ExportSection = { name: string; columns: ExportColumn[]; rows: Record<string, ExportCell>[] }
export type FinanceExport = { title: string; filename: string; subtitle?: string; sections: ExportSection[] }

export const EXPORT_TABS = ["contas-a-pagar", "comissoes-saques", "recebiveis", "quitacoes"] as const
export type ExportTab = (typeof EXPORT_TABS)[number]

const TZ = "America/Sao_Paulo"
const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ }) : "—")
const fmtDateTime = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "—")
const link = (url: string | null | undefined, text = "Abrir comprovante"): ExportCell => (url ? { text, link: url } : "—")

function dueLabel(date: Date) {
  const end = endOfToday()
  const start = new Date(end)
  start.setHours(0, 0, 0, 0)
  if (date < start) return "Vencida"
  if (date <= end) return "Vence hoje"
  return "A vencer"
}

const WITHDRAWAL_STATUS = { PENDING: "Pendente (aguardando aprovação)", APPROVED: "Aprovado (aguardando pagamento)", PAID: "Pago", REJECTED: "Recusado" } as const
const COMMISSION_STATUS = { AWAITING_VALUE: "Aguardando lançamento do valor da conta", PENDING: "Aguardando aprovação", APPROVED: "Aprovada", PAID: "Paga", REJECTED: "Reprovada" } as const
const RECIPIENT_LABEL = { PARTNER: "Parceiro", EMPLOYEE: "Colaborador", EXTERNAL: "Sem cadastro" } as const
const BREAKDOWN_LABEL = {
  SALARIO: "Salário Fixo",
  ADIANTAMENTO: "Adiantamento (dia 20)",
  TAXA_SERVICO: "Taxa de Serviço",
  DIARIA: "Diária",
  VALE_CONSUMO: "Vale/Consumo",
  METAS_BONUS: "Metas/Bônus de Ocorrência",
  OUTROS: "Outros adicionais",
  DESCONTOS: "Descontos",
} as const

const BANK_COLUMNS: ExportColumn[] = [
  { header: "CPF/CNPJ", key: "documento" },
  { header: "Banco", key: "banco" },
  { header: "Agência", key: "agencia" },
  { header: "Conta", key: "conta" },
  { header: "Chave PIX", key: "pix" },
]

export async function buildFinanceExport(
  companyId: string,
  tab: ExportTab,
  params: { month?: string | null; from?: string | null; to?: string | null },
): Promise<FinanceExport> {
  if (tab === "contas-a-pagar") {
    const rows = await listPayables(companyId)
    return {
      title: "Contas a Pagar",
      filename: "contas-a-pagar",
      sections: [
        {
          name: "Contas a Pagar",
          columns: [
            { header: "Favorecido", key: "favorecido" },
            { header: "Tipo", key: "tipo" },
            ...BANK_COLUMNS,
            { header: "Valor", key: "valor", kind: "currency" },
            { header: "Vencimento", key: "vencimento" },
            { header: "Status", key: "status" },
            { header: "Motivo", key: "motivo" },
            { header: "Comprovante", key: "comprovante" },
          ],
          rows: rows.map((r) => ({
            favorecido: r.banking.fullName,
            tipo: RECIPIENT_LABEL[r.recipientType],
            documento: r.banking.document,
            banco: r.banking.bankName,
            agencia: r.banking.agency,
            conta: r.banking.accountNumber,
            pix: r.banking.pixKey,
            valor: r.amount,
            vencimento: fmtDateTime(r.dueDate),
            status: dueLabel(r.dueDate),
            motivo: r.label,
            comprovante: "—",
          })),
        },
      ],
    }
  }

  if (tab === "comissoes-saques") {
    const [withdrawals, commissions] = await Promise.all([listWithdrawals(companyId), listPendingCommissions(companyId)])
    return {
      title: "Comissões e Saques",
      filename: "comissoes-e-saques",
      sections: [
        {
          name: "Saques de Parceiros",
          columns: [
            { header: "Favorecido", key: "favorecido" },
            ...BANK_COLUMNS,
            { header: "Valor", key: "valor", kind: "currency" },
            { header: "Solicitado em", key: "solicitado" },
            { header: "Data prevista de pagamento", key: "prevista" },
            { header: "Status", key: "status" },
            { header: "Motivo", key: "motivo" },
            { header: "Comprovante", key: "comprovante" },
          ],
          rows: withdrawals.map((w) => {
            const p = w.partner.partnerProfile
            return {
              favorecido: p?.fullName?.trim() || w.partner.name,
              documento: p?.cpf ?? p?.document ?? null,
              banco: p?.bankName ?? null,
              agencia: p?.agency ?? null,
              conta: p?.accountNumber ?? null,
              pix: w.pixKey ?? p?.pixKey ?? null,
              valor: Number(w.amount),
              solicitado: fmtDateTime(w.requestDate),
              prevista: fmtDateTime(w.expectedPaymentDate),
              status: WITHDRAWAL_STATUS[w.status],
              motivo: w.status === "REJECTED" ? `Recusado: ${w.rejectionReason ?? "—"}` : "Saque PIX de parceiro",
              comprovante: link(w.proofOfPaymentUrl),
            }
          }),
        },
        {
          name: "Comissões Pendentes",
          columns: [
            { header: "Parceiro", key: "parceiro" },
            { header: "Cliente indicado", key: "cliente" },
            { header: "Valor da conta", key: "conta", kind: "currency" },
            { header: "Comissão", key: "comissao", kind: "currency" },
            { header: "Data", key: "data" },
            { header: "Status", key: "status" },
            { header: "Motivo", key: "motivo" },
            { header: "Comanda", key: "comanda" },
          ],
          rows: commissions.map((c) => ({
            parceiro: c.partner.name,
            cliente: c.clientName,
            conta: c.amount !== null ? Number(c.amount) : null,
            comissao: c.commissionValue !== null ? Number(c.commissionValue) : null,
            data: fmtDate(c.date),
            status: c.amount === null ? COMMISSION_STATUS.AWAITING_VALUE : COMMISSION_STATUS[c.status],
            motivo: `Indicação${c.promotion ? ` — ${c.promotion.title}` : ""}`,
            comanda: link(c.billAttachmentUrl, "Ver comanda"),
          })),
        },
      ],
    }
  }

  if (tab === "recebiveis") {
    const { month, rows } = await listReceivables(companyId, params.month ?? null)
    const total = (b: { paid: number; pending: number }) => b.paid + b.pending
    return {
      title: `Recebíveis de Colaboradores — ${month}`,
      filename: `recebiveis-${month}`,
      sections: [
        {
          name: "Recebíveis",
          columns: [
            { header: "Colaborador", key: "colaborador" },
            ...BANK_COLUMNS,
            { header: "Salário Fixo", key: "salario", kind: "currency" },
            { header: "Adiantamento (dia 20)", key: "adiantamento", kind: "currency" },
            { header: "Taxa de Serviço", key: "taxa", kind: "currency" },
            { header: "Metas/Bônus", key: "metas", kind: "currency" },
            { header: "(-) Descontos/Consumo", key: "descontos", kind: "currency" },
            { header: "Saldo Líquido Restante", key: "liquido", kind: "currency" },
            { header: "Vencimento", key: "vencimento" },
            { header: "Status", key: "status" },
            { header: "Motivo", key: "motivo" },
          ],
          rows: rows.map((r) => {
            const earliest = r.items.map((i) => i.dueDate).sort((a, b) => a.getTime() - b.getTime())[0]
            return {
              colaborador: r.banking.fullName,
              documento: r.banking.document,
              banco: r.banking.bankName,
              agencia: r.banking.agency,
              conta: r.banking.accountNumber,
              pix: r.banking.pixKey,
              salario: r.monthlySalary,
              adiantamento: total(r.projection.adiantamento),
              taxa: total(r.projection.taxaServico),
              metas: total(r.projection.metas),
              descontos: r.totals.discounts + r.totals.consumo,
              liquido: r.totals.netRemaining,
              vencimento: earliest ? fmtDate(earliest) : "—",
              status: r.items.length === 0 ? "Quitado" : "Pendente",
              motivo: `Folha ${r.month}`,
            }
          }),
        },
        {
          name: "Detalhamento",
          columns: [
            { header: "Colaborador", key: "colaborador" },
            { header: "Categoria", key: "categoria" },
            { header: "Descrição", key: "descricao" },
            { header: "Tipo", key: "tipo" },
            { header: "Valor", key: "valor", kind: "currency" },
            { header: "Vencimento", key: "vencimento" },
            { header: "Status", key: "status" },
          ],
          rows: rows.flatMap((r) =>
            r.breakdown.map((b) => ({
              colaborador: r.banking.fullName,
              categoria: BREAKDOWN_LABEL[b.category],
              descricao: b.label,
              tipo: b.sign === 1 ? "Provento" : "Desconto",
              valor: b.sign === 1 ? b.amount : -b.amount,
              vencimento: fmtDate(b.dueDate),
              status: b.status === "PAID" ? "Pago" : "Pendente",
            })),
          ),
        },
      ],
    }
  }

  const settlements = await listSettlements(companyId, params.from ?? null, params.to ?? null)
  const period = `${params.from ? fmtDate(`${params.from}T12:00:00`) : "início"} a ${params.to ? fmtDate(`${params.to}T12:00:00`) : "hoje"}`
  return {
    title: "Registro de Quitação",
    filename: "registro-de-quitacao",
    subtitle: `Período: ${period}`,
    sections: [
      {
        name: "Quitações",
        columns: [
          { header: "Pago em", key: "pagoEm" },
          { header: "Favorecido", key: "favorecido" },
          { header: "Tipo", key: "tipo" },
          { header: "CPF/CNPJ", key: "documento" },
          { header: "Chave PIX", key: "pix" },
          { header: "Valor", key: "valor", kind: "currency" },
          { header: "Forma de pagamento", key: "forma" },
          { header: "Vencimento", key: "vencimento" },
          { header: "Status", key: "status" },
          { header: "Motivo", key: "motivo" },
          { header: "Pago por", key: "pagoPor" },
          { header: "Comprovante", key: "comprovante" },
          { header: "Omie", key: "omie" },
        ],
        rows: settlements.map((s) => ({
          pagoEm: fmtDateTime(s.paidAt),
          favorecido: s.recipientName,
          tipo: RECIPIENT_LABEL[s.recipientType as keyof typeof RECIPIENT_LABEL] ?? s.recipientType,
          documento: s.recipientDocument,
          pix: s.pixKey,
          valor: s.amount,
          forma: PAYMENT_METHOD_LABELS_PT[s.paymentMethod],
          vencimento: fmtDate(s.dueDate),
          status: "Pago",
          motivo: s.description,
          pagoPor: s.paidBy.name,
          comprovante: link(s.proofUrl),
          omie: s.omieStatus ?? "Não sincronizado",
        })),
      },
    ],
  }
}

export async function renderXlsx(report: FinanceExport): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Tribuss"
  for (const section of report.sections) {
    const sheet = workbook.addWorksheet(section.name.slice(0, 31))
    sheet.columns = section.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.max(14, Math.min(42, c.header.length + 6)),
      style: c.kind === "currency" ? { numFmt: '"R$" #,##0.00' } : {},
    }))
    const header = sheet.getRow(1)
    header.font = { bold: true, color: { argb: "FFFFFFFF" } }
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E2415" } }
    for (const row of section.rows) {
      const added = sheet.addRow(
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v !== null && typeof v === "object" ? { text: v.text, hyperlink: v.link } : v])),
      )
      section.columns.forEach((c, i) => {
        const value = row[c.key]
        if (value !== null && typeof value === "object") added.getCell(i + 1).font = { color: { argb: "FF0563C1" }, underline: true }
      })
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

export function renderPdf(report: FinanceExport): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  doc.setFontSize(14)
  doc.text(report.title, 40, 36)
  doc.setFontSize(9)
  doc.text(`${report.subtitle ? `${report.subtitle} · ` : ""}Gerado em ${fmtDateTime(new Date())}`, 40, 50)

  let startY = 66
  for (const section of report.sections) {
    doc.setFontSize(11)
    doc.text(section.name, 40, startY)
    const links = new Map<string, string>()
    autoTable(doc, {
      startY: startY + 6,
      head: [section.columns.map((c) => c.header)],
      body: section.rows.map((row, r) =>
        section.columns.map((c, col) => {
          const value = row[c.key]
          if (value === null || value === undefined || value === "") return "—"
          if (typeof value === "object") {
            links.set(`${r}:${col}`, value.link)
            return value.text
          }
          return c.kind === "currency" && typeof value === "number" ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(value)
        }),
      ),
      styles: { fontSize: 6.5, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [62, 36, 21] },
      margin: { left: 30, right: 30 },
      didDrawCell: (data) => {
        const url = data.section === "body" ? links.get(`${data.row.index}:${data.column.index}`) : undefined
        if (url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url })
      },
    })
    startY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 28
    if (startY > 520) {
      doc.addPage()
      startY = 40
    }
  }
  return new Uint8Array(doc.output("arraybuffer"))
}

export function parseExportTab(raw: string | null): ExportTab {
  if (!EXPORT_TABS.includes(raw as ExportTab)) throw new ApiError(400, "Aba inválida para exportação")
  return raw as ExportTab
}
