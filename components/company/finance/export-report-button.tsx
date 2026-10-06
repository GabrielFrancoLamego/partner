"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { scopedUrl } from "@/lib/admin-api-client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type ExportTab = "contas-a-pagar" | "comissoes-saques" | "recebiveis" | "quitacoes"

/**
 * "Exportar Relatório" — baixa o Excel (.xlsx) ou PDF gerado no servidor
 * (GET /api/company/finance/export) com os mesmos dados e filtros da aba:
 * `params` carrega ?month= (Recebíveis) ou ?from=&to= (Quitações).
 */
export function ExportReportButton({ tab, params, disabled }: { tab: ExportTab; params?: Record<string, string>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)

  const run = async (format: "xlsx" | "pdf") => {
    setBusy(true)
    try {
      const qs = new URLSearchParams({ tab, format, ...(params ?? {}) })
      const response = await fetch(scopedUrl(`/api/company/finance/export?${qs.toString()}`))
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Erro ${response.status}`)
      }
      const blob = await response.blob()
      const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `relatorio-${tab}.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      alert(`Não foi possível gerar o relatório: ${error instanceof Error ? error.message : "tente novamente"}`)
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
