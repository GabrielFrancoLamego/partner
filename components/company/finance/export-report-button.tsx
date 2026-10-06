"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type ExportColumn = { header: string; key: string; kind?: "text" | "currency" }
export type ExportSection = { name: string; columns: ExportColumn[]; rows: Record<string, string | number | null>[] }

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function exportXlsx(filename: string, sections: ExportSection[]) {
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  for (const section of sections) {
    const sheet = workbook.addWorksheet(section.name.slice(0, 31))
    sheet.columns = section.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.max(14, c.header.length + 4),
      style: c.kind === "currency" ? { numFmt: '"R$" #,##0.00' } : undefined,
    }))
    sheet.getRow(1).font = { bold: true }
    section.rows.forEach((row) => sheet.addRow(row))
  }
  const buffer = await workbook.xlsx.writeBuffer()
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`)
}

async function exportPdf(title: string, filename: string, sections: ExportSection[]) {
  const { jsPDF } = await import("jspdf")
  const autoTableModule = await import("jspdf-autotable")
  const autoTable = autoTableModule.default ?? autoTableModule.autoTable
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

  doc.setFontSize(14)
  doc.text(title, 40, 36)
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 50)

  let startY = 66
  for (const section of sections) {
    doc.setFontSize(11)
    doc.text(section.name, 40, startY)
    autoTable(doc, {
      startY: startY + 6,
      head: [section.columns.map((c) => c.header)],
      body: section.rows.map((row) =>
        section.columns.map((c) => {
          const value = row[c.key]
          if (value === null || value === undefined || value === "") return "—"
          return c.kind === "currency" && typeof value === "number" ? brl(value) : String(value)
        }),
      ),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [62, 36, 21] },
      margin: { left: 40, right: 40 },
    })
    startY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 28
  }

  download(doc.output("blob"), `${filename}.pdf`)
}

/** "Exportar Relatório" — Excel (.xlsx) ou PDF com todos os campos da tabela exibida. */
export function ExportReportButton({ title, filename, sections, disabled }: { title: string; filename: string; sections: ExportSection[]; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  const stamp = new Date().toISOString().slice(0, 10)

  const run = async (kind: "xlsx" | "pdf") => {
    setBusy(true)
    try {
      if (kind === "xlsx") await exportXlsx(`${filename}-${stamp}`, sections)
      else await exportPdf(title, `${filename}-${stamp}`, sections)
    } catch {
      alert("Não foi possível gerar o relatório. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Exportar Relatório
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("xlsx")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Baixar Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")}>
          <FileText className="h-4 w-4 mr-2" /> Baixar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
