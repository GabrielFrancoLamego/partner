"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { FileSpreadsheet, FileText, ImageIcon, TrendingUp, DollarSign, Users, QrCode, Receipt } from "lucide-react"

type ReportPeriod = "today" | "7days" | "30days" | "90days" | "year" | "custom"

export function ReportsContent() {
  const [period, setPeriod] = useState<ReportPeriod>("30days")
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" })

  // Mock data for reports
  const reportData = {
    receitas: 245780.5,
    custos: 98350.2,
    cmv: 0.4, // 40%
    indicacoes: 523,
    qrcodesGerados: 1250,
    qrcodesUsados: 847,
    ticketMedio: 185.32,
    comissoesGeradas: 24578.05,
    comissoesPagas: 18433.54,
  }

  const exportToExcel = () => {
    const csvContent = [
      ["Métrica", "Valor"],
      ["Receitas", `R$ ${reportData.receitas.toFixed(2)}`],
      ["Custos", `R$ ${reportData.custos.toFixed(2)}`],
      ["CMV", `${(reportData.cmv * 100).toFixed(1)}%`],
      ["Indicações", reportData.indicacoes.toString()],
      ["QR Codes Gerados", reportData.qrcodesGerados.toString()],
      ["QR Codes Usados", reportData.qrcodesUsados.toString()],
      ["Ticket Médio", `R$ ${reportData.ticketMedio.toFixed(2)}`],
      ["Comissões Geradas", `R$ ${reportData.comissoesGeradas.toFixed(2)}`],
      ["Comissões Pagas", `R$ ${reportData.comissoesPagas.toFixed(2)}`],
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio_geral_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const exportToPDF = () => {
    const pdfContent = `
RELATÓRIO GERAL - NOMAD'S JERI
Período: ${getPeriodLabel()}
Data de Geração: ${new Date().toLocaleDateString("pt-BR")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECEITAS E CUSTOS
Receitas Total: R$ ${reportData.receitas.toFixed(2)}
Custos Total: R$ ${reportData.custos.toFixed(2)}
CMV (Custo de Mercadoria Vendida): ${(reportData.cmv * 100).toFixed(1)}%
Lucro Bruto: R$ ${(reportData.receitas - reportData.custos).toFixed(2)}

INDICAÇÕES
Total de Indicações: ${reportData.indicacoes}
Ticket Médio: R$ ${reportData.ticketMedio.toFixed(2)}

QR CODES
QR Codes Gerados: ${reportData.qrcodesGerados}
QR Codes Usados: ${reportData.qrcodesUsados}
Taxa de Conversão: ${((reportData.qrcodesUsados / reportData.qrcodesGerados) * 100).toFixed(1)}%

COMISSÕES
Comissões Geradas: R$ ${reportData.comissoesGeradas.toFixed(2)}
Comissões Pagas: R$ ${reportData.comissoesPagas.toFixed(2)}
Comissões Pendentes: R$ ${(reportData.comissoesGeradas - reportData.comissoesPagas).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim()

    const blob = new Blob([pdfContent], { type: "text/plain;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio_geral_${new Date().toISOString().split("T")[0]}.txt`
    link.click()
  }

  const exportToImage = () => {
    // Create a canvas with the report data
    const canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 1400
    const ctx = canvas.getContext("2d")

    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, "#FF7A28")
      gradient.addColorStop(0.5, "#FFBE3B")
      gradient.addColorStop(1, "#0078B7")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // White content box
      ctx.fillStyle = "white"
      ctx.roundRect(50, 50, canvas.width - 100, canvas.height - 100, 20)
      ctx.fill()

      // Title
      ctx.fillStyle = "#0A2E4D"
      ctx.font = "bold 48px system-ui"
      ctx.fillText("RELATÓRIO GERAL", 100, 140)

      ctx.font = "24px system-ui"
      ctx.fillStyle = "#666"
      ctx.fillText(`Período: ${getPeriodLabel()}`, 100, 190)
      ctx.fillText(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 100, 230)

      // Data sections
      let yPos = 320
      const lineHeight = 60

      const sections = [
        { label: "Receitas Total", value: `R$ ${reportData.receitas.toFixed(2)}`, color: "#0078B7" },
        { label: "Custos Total", value: `R$ ${reportData.custos.toFixed(2)}`, color: "#FF7A28" },
        { label: "CMV", value: `${(reportData.cmv * 100).toFixed(1)}%`, color: "#0A2E4D" },
        { label: "Indicações", value: reportData.indicacoes.toString(), color: "#0078B7" },
        { label: "QR Codes Gerados", value: reportData.qrcodesGerados.toString(), color: "#FFBE3B" },
        { label: "QR Codes Usados", value: reportData.qrcodesUsados.toString(), color: "#0078B7" },
        { label: "Ticket Médio", value: `R$ ${reportData.ticketMedio.toFixed(2)}`, color: "#0A2E4D" },
        { label: "Comissões Geradas", value: `R$ ${reportData.comissoesGeradas.toFixed(2)}`, color: "#0078B7" },
        { label: "Comissões Pagas", value: `R$ ${reportData.comissoesPagas.toFixed(2)}`, color: "#FF7A28" },
      ]

      sections.forEach((section) => {
        ctx.font = "26px system-ui"
        ctx.fillStyle = "#666"
        ctx.fillText(section.label, 100, yPos)

        ctx.font = "bold 32px system-ui"
        ctx.fillStyle = section.color
        ctx.fillText(section.value, 700, yPos)

        yPos += lineHeight
      })

      // Convert to image and download
      canvas.toBlob((blob) => {
        if (blob) {
          const link = document.createElement("a")
          link.href = URL.createObjectURL(blob)
          link.download = `relatorio_geral_${new Date().toISOString().split("T")[0]}.png`
          link.click()
        }
      })
    }
  }

  const getPeriodLabel = () => {
    switch (period) {
      case "today":
        return "Hoje"
      case "7days":
        return "Últimos 7 dias"
      case "30days":
        return "Últimos 30 dias"
      case "90days":
        return "Últimos 90 dias"
      case "year":
        return "Último ano"
      case "custom":
        return `${customDateRange.start} até ${customDateRange.end}`
      default:
        return "Últimos 30 dias"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0A2E4D] mb-1">Relatórios Gerais</h2>
            <p className="text-gray-600 text-sm">Exporte dados completos em diferentes formatos</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setPeriod("today")}
              variant={period === "today" ? "default" : "outline"}
              size="sm"
              className={
                period === "today" ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90" : ""
              }
            >
              Hoje
            </Button>
            <Button
              onClick={() => setPeriod("7days")}
              variant={period === "7days" ? "default" : "outline"}
              size="sm"
              className={
                period === "7days" ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90" : ""
              }
            >
              7 dias
            </Button>
            <Button
              onClick={() => setPeriod("30days")}
              variant={period === "30days" ? "default" : "outline"}
              size="sm"
              className={
                period === "30days" ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90" : ""
              }
            >
              30 dias
            </Button>
            <Button
              onClick={() => setPeriod("90days")}
              variant={period === "90days" ? "default" : "outline"}
              size="sm"
              className={
                period === "90days" ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90" : ""
              }
            >
              90 dias
            </Button>
            <Button
              onClick={() => setPeriod("year")}
              variant={period === "year" ? "default" : "outline"}
              size="sm"
              className={
                period === "year" ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90" : ""
              }
            >
              Ano
            </Button>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <h3 className="text-lg font-bold text-[#0A2E4D] mb-4">Exportar Relatório</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={exportToExcel}
            className="bg-gradient-to-r from-[#10B981] to-[#059669] text-white hover:opacity-90"
          >
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Exportar Excel (CSV)
          </Button>
          <Button
            onClick={exportToPDF}
            className="bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white hover:opacity-90"
          >
            <FileText className="w-5 h-5 mr-2" />
            Exportar PDF (TXT)
          </Button>
          <Button
            onClick={exportToImage}
            className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white hover:opacity-90"
          >
            <ImageIcon className="w-5 h-5 mr-2" />
            Exportar Imagem
          </Button>
        </div>
      </div>

      {/* Report Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Receitas */}
        <div className="bg-gradient-to-br from-[#0078B7] to-[#005A8C] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Financeiro</span>
          </div>
          <p className="text-3xl font-bold mb-1">R$ {reportData.receitas.toLocaleString("pt-BR")}</p>
          <p className="text-sm opacity-90">Receitas Total</p>
        </div>

        {/* Custos */}
        <div className="bg-gradient-to-br from-[#FF7A28] to-[#E56020] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Despesas</span>
          </div>
          <p className="text-3xl font-bold mb-1">R$ {reportData.custos.toLocaleString("pt-BR")}</p>
          <p className="text-sm opacity-90">Custos Total</p>
        </div>

        {/* CMV */}
        <div className="bg-gradient-to-br from-[#FFBE3B] to-[#E5A822] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Receipt className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Margem</span>
          </div>
          <p className="text-3xl font-bold mb-1">{(reportData.cmv * 100).toFixed(1)}%</p>
          <p className="text-sm opacity-90">CMV</p>
        </div>

        {/* Indicações */}
        <div className="bg-gradient-to-br from-[#0078B7] to-[#005A8C] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Clientes</span>
          </div>
          <p className="text-3xl font-bold mb-1">{reportData.indicacoes}</p>
          <p className="text-sm opacity-90">Indicações</p>
        </div>

        {/* QR Codes Gerados */}
        <div className="bg-gradient-to-br from-[#FFBE3B] to-[#E5A822] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <QrCode className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Gerados</span>
          </div>
          <p className="text-3xl font-bold mb-1">{reportData.qrcodesGerados}</p>
          <p className="text-sm opacity-90">QR Codes Gerados</p>
        </div>

        {/* QR Codes Usados */}
        <div className="bg-gradient-to-br from-[#0078B7] to-[#005A8C] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <QrCode className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Utilizados</span>
          </div>
          <p className="text-3xl font-bold mb-1">{reportData.qrcodesUsados}</p>
          <p className="text-sm opacity-90">QR Codes Usados</p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-gradient-to-br from-[#FF7A28] to-[#E56020] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Receipt className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Média</span>
          </div>
          <p className="text-3xl font-bold mb-1">R$ {reportData.ticketMedio.toFixed(2)}</p>
          <p className="text-sm opacity-90">Ticket Médio</p>
        </div>

        {/* Comissões Geradas */}
        <div className="bg-gradient-to-br from-[#0078B7] to-[#005A8C] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Geradas</span>
          </div>
          <p className="text-3xl font-bold mb-1">R$ {reportData.comissoesGeradas.toLocaleString("pt-BR")}</p>
          <p className="text-sm opacity-90">Comissões Geradas</p>
        </div>

        {/* Comissões Pagas */}
        <div className="bg-gradient-to-br from-[#FFBE3B] to-[#E5A822] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Pagas</span>
          </div>
          <p className="text-3xl font-bold mb-1">R$ {reportData.comissoesPagas.toLocaleString("pt-BR")}</p>
          <p className="text-sm opacity-90">Comissões Pagas</p>
        </div>
      </div>
    </div>
  )
}
