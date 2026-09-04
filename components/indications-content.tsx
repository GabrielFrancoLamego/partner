"use client"

import { useState } from "react"
import { Users, CheckCircle, XCircle, DollarSign, Filter, Search, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Indication = {
  id: number
  clientName: string
  clientEmail: string
  clientPhone: string
  partnerId: string
  partnerName: string
  program: string
  indicatedAt: string
  visited: boolean
  visitDate?: string
  billAmount?: number
  commissionAmount?: number
  status: "pending" | "visited" | "not-visited"
}

export function IndicationsContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPartner, setFilterPartner] = useState<string>("all")

  const [indications] = useState<Indication[]>([
    {
      id: 1,
      clientName: "Maria Silva",
      clientEmail: "maria@email.com",
      clientPhone: "(85) 99999-0001",
      partnerId: "P001",
      partnerName: "João Costa",
      program: "Premium 15%",
      indicatedAt: "15/01/2025",
      visited: true,
      visitDate: "16/01/2025",
      billAmount: 450.0,
      commissionAmount: 67.5,
      status: "visited",
    },
    {
      id: 2,
      clientName: "Pedro Santos",
      clientEmail: "pedro@email.com",
      clientPhone: "(85) 99999-0002",
      partnerId: "P002",
      partnerName: "Ana Lima",
      program: "Standard 10%",
      indicatedAt: "14/01/2025",
      visited: true,
      visitDate: "15/01/2025",
      billAmount: 320.0,
      commissionAmount: 32.0,
      status: "visited",
    },
    {
      id: 3,
      clientName: "Juliana Oliveira",
      clientEmail: "juliana@email.com",
      clientPhone: "(85) 99999-0003",
      partnerId: "P003",
      partnerName: "Carlos Mendes",
      program: "VIP 20%",
      indicatedAt: "13/01/2025",
      visited: false,
      status: "not-visited",
    },
    {
      id: 4,
      clientName: "Roberto Alves",
      clientEmail: "roberto@email.com",
      clientPhone: "(85) 99999-0004",
      partnerId: "P001",
      partnerName: "João Costa",
      program: "Premium 15%",
      indicatedAt: "12/01/2025",
      visited: true,
      visitDate: "13/01/2025",
      billAmount: 580.0,
      commissionAmount: 87.0,
      status: "visited",
    },
    {
      id: 5,
      clientName: "Fernanda Costa",
      clientEmail: "fernanda@email.com",
      clientPhone: "(85) 99999-0005",
      partnerId: "P002",
      partnerName: "Ana Lima",
      program: "Standard 10%",
      indicatedAt: "11/01/2025",
      visited: false,
      status: "pending",
    },
    {
      id: 6,
      clientName: "Lucas Martins",
      clientEmail: "lucas@email.com",
      clientPhone: "(85) 99999-0006",
      partnerId: "P004",
      partnerName: "Beatriz Souza",
      program: "Premium 15%",
      indicatedAt: "10/01/2025",
      visited: true,
      visitDate: "11/01/2025",
      billAmount: 720.0,
      commissionAmount: 108.0,
      status: "visited",
    },
  ])

  // Calculate stats
  const stats = {
    totalIndications: indications.length,
    visited: indications.filter((i) => i.status === "visited").length,
    notVisited: indications.filter((i) => i.status === "not-visited").length,
    pending: indications.filter((i) => i.status === "pending").length,
    totalRevenue: indications.reduce((sum, i) => sum + (i.billAmount || 0), 0),
    totalCommissions: indications.reduce((sum, i) => sum + (i.commissionAmount || 0), 0),
  }

  // Get unique partners for filter
  const partners = Array.from(new Set(indications.map((i) => i.partnerName)))

  // Filter indications
  const filteredIndications = indications.filter((indication) => {
    const matchesSearch =
      indication.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indication.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indication.partnerName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === "all" || indication.status === filterStatus

    const matchesPartner = filterPartner === "all" || indication.partnerName === filterPartner

    return matchesSearch && matchesStatus && matchesPartner
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#3E2415]">Indicações</h2>
          <p className="text-gray-600 mt-1 text-sm">Gerencie todas as indicações realizadas</p>
        </div>

        <Button
          size="sm"
          className="bg-gradient-to-r from-[#3E2415] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#3E2415] to-[#FFC800] rounded-xl flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <h3 className="text-gray-600 text-xs font-medium mb-1">Total de Indicações</h3>
          <p className="text-xl font-bold text-[#3E2415]">{stats.totalIndications}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {Math.round((stats.visited / stats.totalIndications) * 100)}%
            </span>
          </div>
          <h3 className="text-gray-600 text-xs font-medium mb-1">Visitaram</h3>
          <p className="text-xl font-bold text-[#3E2415]">{stats.visited}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-md">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
              {Math.round((stats.notVisited / stats.totalIndications) * 100)}%
            </span>
          </div>
          <h3 className="text-gray-600 text-xs font-medium mb-1">Não Visitaram</h3>
          <p className="text-xl font-bold text-[#3E2415]">{stats.notVisited}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-xl flex items-center justify-center shadow-md">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              R$ {stats.totalCommissions.toFixed(0)}
            </span>
          </div>
          <h3 className="text-gray-600 text-xs font-medium mb-1">Faturamento Gerado</h3>
          <p className="text-xl font-bold text-[#3E2415]">R$ {stats.totalRevenue.toLocaleString("pt-BR")}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-[#3E2415]" />
          <h3 className="text-lg font-bold text-[#3E2415]">Filtros e Busca</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, email ou parceiro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E2415] text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="visited">Visitaram</option>
            <option value="not-visited">Não visitaram</option>
            <option value="pending">Pendentes</option>
          </select>

          <select
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E2415] text-sm"
          >
            <option value="all">Todos os parceiros</option>
            {partners.map((partner) => (
              <option key={partner} value={partner}>
                {partner}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
          <span>
            Mostrando {filteredIndications.length} de {stats.totalIndications} indicações
          </span>
          {(searchTerm || filterStatus !== "all" || filterPartner !== "all") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchTerm("")
                setFilterStatus("all")
                setFilterPartner("all")
              }}
              className="text-[#3E2415] hover:text-[#F58220] text-xs h-6 px-2"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Indications List */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <h3 className="text-lg font-bold text-[#3E2415] mb-4">Lista de Indicações</h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Contato</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Parceiro</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Programa</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Indicado em</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Faturamento</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndications.map((indication) => (
                <tr key={indication.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-semibold text-[#3E2415] text-sm">{indication.clientName}</p>
                      <p className="text-xs text-gray-500">{indication.clientEmail}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-gray-600">{indication.clientPhone}</p>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-[#3E2415] text-sm">{indication.partnerName}</p>
                      <p className="text-xs text-gray-500">ID: {indication.partnerId}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-block bg-[#FFC800] bg-opacity-20 text-[#3E2415] px-3 py-1 rounded-full text-xs font-medium">
                      {indication.program}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-sm text-gray-600">{indication.indicatedAt}</p>
                    {indication.visitDate && <p className="text-xs text-gray-500">Visitou: {indication.visitDate}</p>}
                  </td>
                  <td className="py-4 px-4">
                    {indication.status === "visited" && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Visitou
                      </span>
                    )}
                    {indication.status === "not-visited" && (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Não visitou
                      </span>
                    )}
                    {indication.status === "pending" && (
                      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {indication.billAmount ? (
                      <p className="font-semibold text-[#3E2415] text-sm">
                        R$ {indication.billAmount.toLocaleString("pt-BR")}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm">-</p>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {indication.commissionAmount ? (
                      <p className="font-semibold text-green-600 text-sm">
                        R$ {indication.commissionAmount.toLocaleString("pt-BR")}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm">-</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredIndications.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Nenhuma indicação encontrada</p>
            <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros de busca</p>
          </div>
        )}
      </div>
    </div>
  )
}
