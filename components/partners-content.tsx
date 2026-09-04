"use client"

import { useState } from "react"
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  Users,
  Award,
  Clock,
  Eye,
  Wallet,
  Plus,
  Minus,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Partner = {
  id: string
  name: string
  email: string
  phone: string
  photo: string
  level: string
  levelColor: string
  registerDate: string
  lastIndication: string
  totalIndications: number
  activeIndications: number
  totalCommission: number
  walletBalance: number
  pix: string
  status: "active" | "inactive"
}

type WalletTransaction = {
  id: string
  type: "commission" | "withdrawal" | "manual_credit" | "manual_debit"
  amount: number
  description: string
  date: string
  status: "completed" | "pending"
}

export function PartnersContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [activityFilter, setActivityFilter] = useState<string>("all")
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showLevelChangeModal, setShowLevelChangeModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditAction, setCreditAction] = useState<"add" | "remove">("add")

  const [partners, setPartners] = useState<Partner[]>([
    {
      id: "1",
      name: "Carlos Silva",
      email: "carlos@email.com",
      phone: "+55 85 98765-4321",
      photo: "/placeholder.svg?height=100&width=100",
      level: "Diamante",
      levelColor: "from-blue-400 to-purple-500",
      registerDate: "2024-01-15",
      lastIndication: "2024-01-25",
      totalIndications: 45,
      activeIndications: 12,
      totalCommission: 8500,
      walletBalance: 1250,
      pix: "carlos@email.com",
      status: "active",
    },
    {
      id: "2",
      name: "Maria Santos",
      email: "maria@email.com",
      phone: "+55 85 98765-1234",
      photo: "/placeholder.svg?height=100&width=100",
      level: "Ouro",
      levelColor: "from-yellow-400 to-orange-500",
      registerDate: "2024-02-10",
      lastIndication: "2024-01-20",
      totalIndications: 28,
      activeIndications: 8,
      totalCommission: 4200,
      walletBalance: 850,
      pix: "+55 85 98765-1234",
      status: "active",
    },
    {
      id: "3",
      name: "João Oliveira",
      email: "joao@email.com",
      phone: "+55 85 98765-5678",
      photo: "/placeholder.svg?height=100&width=100",
      level: "Prata",
      levelColor: "from-gray-300 to-gray-400",
      registerDate: "2023-11-05",
      lastIndication: "2023-12-10",
      totalIndications: 12,
      activeIndications: 3,
      totalCommission: 1800,
      walletBalance: 320,
      pix: "joao@email.com",
      status: "inactive",
    },
  ])

  const [walletTransactions] = useState<WalletTransaction[]>([
    {
      id: "1",
      type: "commission",
      amount: 150,
      description: "Comissão - Mesa #1234",
      date: "2024-01-25",
      status: "completed",
    },
    {
      id: "2",
      type: "withdrawal",
      amount: -500,
      description: "Saque aprovado",
      date: "2024-01-20",
      status: "completed",
    },
    {
      id: "3",
      type: "manual_credit",
      amount: 200,
      description: "Bônus de boas-vindas",
      date: "2024-01-15",
      status: "completed",
    },
  ])

  const filterPartners = () => {
    let filtered = partners

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Level filter
    if (levelFilter !== "all") {
      filtered = filtered.filter((p) => p.level === levelFilter)
    }

    // Activity filter
    if (activityFilter !== "all") {
      const now = new Date()
      filtered = filtered.filter((p) => {
        const lastIndicationDate = new Date(p.lastIndication)
        const daysSince = Math.floor((now.getTime() - lastIndicationDate.getTime()) / (1000 * 60 * 60 * 24))

        switch (activityFilter) {
          case "7days":
            return daysSince <= 7
          case "30days":
            return daysSince <= 30
          case "60days":
            return daysSince <= 60
          case "90days":
            return daysSince <= 90
          case "inactive30":
            return daysSince > 30
          default:
            return true
        }
      })
    }

    return filtered
  }

  const handleChangeLevelManually = (partnerId: string, newLevel: string, endDate: string) => {
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId
          ? { ...p, level: newLevel, levelColor: getLevelColor(newLevel), temporaryLevelEnd: endDate }
          : p,
      ),
    )
    setShowLevelChangeModal(false)
  }

  const handleWalletAction = (partnerId: string, action: "add" | "remove", amount: number, reason: string) => {
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId
          ? { ...p, walletBalance: action === "add" ? p.walletBalance + amount : p.walletBalance - amount }
          : p,
      ),
    )
    setShowCreditModal(false)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Diamante":
        return "from-blue-400 to-purple-500"
      case "Ouro":
        return "from-yellow-400 to-orange-500"
      case "Prata":
        return "from-gray-300 to-gray-400"
      default:
        return "from-gray-300 to-gray-400"
    }
  }

  const filteredPartners = filterPartners()

  const handleExportIndicationsReport = (partner: Partner) => {
    const reportData = `
RELATÓRIO DE INDICAÇÕES
========================

Parceiro: ${partner.name}
Email: ${partner.email}
Telefone: ${partner.phone}
Nível: ${partner.level}

ESTATÍSTICAS:
- Total de Indicações: ${partner.totalIndications}
- Indicações Ativas: ${partner.activeIndications}
- Comissão Total: R$ ${partner.totalCommission.toFixed(2)}
- Carteira: R$ ${partner.walletBalance.toFixed(2)}

Data do Cadastro: ${new Date(partner.registerDate).toLocaleDateString("pt-BR")}
Última Indicação: ${new Date(partner.lastIndication).toLocaleDateString("pt-BR")}
    `

    const blob = new Blob([reportData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-indicacoes-${partner.name.toLowerCase().replace(/\s+/g, "-")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportQRCodesReport = (partner: Partner) => {
    const reportData = `
RELATÓRIO DE QR CODES
=====================

Parceiro: ${partner.name}
Email: ${partner.email}
Nível: ${partner.level}

ESTATÍSTICAS:
- QR Codes Gerados: 23
- QR Codes Utilizados: 18
- Taxa de Utilização: 78%

Total de Indicações: ${partner.totalIndications}
Comissão Total Gerada: R$ ${partner.totalCommission.toFixed(2)}

Data do Relatório: ${new Date().toLocaleDateString("pt-BR")}
    `

    const blob = new Blob([reportData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-qrcodes-${partner.name.toLowerCase().replace(/\s+/g, "-")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportRanking = () => {
    const rankingData = [...partners]
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .map(
        (partner, index) =>
          `${index + 1}º - ${partner.name} - ${partner.level} - R$ ${partner.totalCommission.toFixed(2)} - ${partner.totalIndications} indicações`,
      )
      .join("\n")

    const reportData = `
RANKING DE PARCEIROS
====================

Data: ${new Date().toLocaleDateString("pt-BR")}

${rankingData}

Total de Parceiros: ${partners.length}
    `

    const blob = new Blob([reportData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ranking-parceiros-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-6 text-white shadow-lg">
          <Users className="w-8 h-8 mb-2 opacity-90" />
          <p className="text-sm opacity-90">Total Parceiros</p>
          <p className="text-3xl font-bold">{partners.length}</p>
        </div>
        <div className="bg-gradient-to-br from-[#3E2415] to-[#FFC800] rounded-2xl p-6 text-white shadow-lg">
          <TrendingUp className="w-8 h-8 mb-2 opacity-90" />
          <p className="text-sm opacity-90">Ativos (7 dias)</p>
          <p className="text-3xl font-bold">
            {
              partners.filter((p) => {
                const daysSince = Math.floor(
                  (new Date().getTime() - new Date(p.lastIndication).getTime()) / (1000 * 60 * 60 * 24),
                )
                return daysSince <= 7
              }).length
            }
          </p>
        </div>
        <div className="bg-gradient-to-br from-[#FFC800] to-[#F58220] rounded-2xl p-6 text-white shadow-lg">
          <Award className="w-8 h-8 mb-2 opacity-90" />
          <p className="text-sm opacity-90">Diamante</p>
          <p className="text-3xl font-bold">{partners.filter((p) => p.level === "Diamante").length}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-6 text-white shadow-lg">
          <Clock className="w-8 h-8 mb-2 opacity-90" />
          <p className="text-sm opacity-90">Inativos 30+ dias</p>
          <p className="text-3xl font-bold">
            {
              partners.filter((p) => {
                const daysSince = Math.floor(
                  (new Date().getTime() - new Date(p.lastIndication).getTime()) / (1000 * 60 * 60 * 24),
                )
                return daysSince > 30
              }).length
            }
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-[#F58220]" />
          <h3 className="text-lg font-bold text-[#3E2415]">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm text-gray-600 mb-2 block">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm text-gray-600 mb-2 block">Nível</Label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F58220] focus:border-transparent"
            >
              <option value="all">Todos os níveis</option>
              <option value="Diamante">Diamante</option>
              <option value="Ouro">Ouro</option>
              <option value="Prata">Prata</option>
            </select>
          </div>
          <div>
            <Label className="text-sm text-gray-600 mb-2 block">Atividade</Label>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F58220] focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="7days">Indicou nos últimos 7 dias</option>
              <option value="30days">Indicou nos últimos 30 dias</option>
              <option value="60days">Indicou nos últimos 60 dias</option>
              <option value="90days">Indicou nos últimos 90 dias</option>
              <option value="inactive30">Sem indicação há 30+ dias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ranking Section */}
      <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-6 shadow-lg text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6" />
            <h3 className="text-xl font-bold">Ranking de Parceiros</h3>
          </div>
          <Button
            variant="outline"
            className="bg-white text-[#F58220] hover:bg-gray-50 border-0"
            onClick={handleExportRanking}
          >
            <Download className="w-4 h-4 mr-2" />
            Extrair Ranking
          </Button>
        </div>
        <div className="space-y-2">
          {[...partners]
            .sort((a, b) => b.totalCommission - a.totalCommission)
            .slice(0, 5)
            .map((partner, index) => (
              <div
                key={partner.id}
                className="flex items-center justify-between bg-white/20 rounded-lg p-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{index + 1}º</span>
                  <div>
                    <p className="font-semibold">{partner.name}</p>
                    <p className="text-sm opacity-90">{partner.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">R$ {partner.totalCommission.toFixed(2)}</p>
                  <p className="text-sm opacity-90">{partner.totalIndications} indicações</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Partners List */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#3E2415]">Parceiros ({filteredPartners.length})</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPartners.map((partner) => (
            <div
              key={partner.id}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedPartner(partner)}
            >
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={partner.photo || "/placeholder.svg"}
                  alt={partner.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-[#3E2415]">{partner.name}</h4>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${partner.levelColor}`}
                  >
                    {partner.level}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>📧 {partner.email}</p>
                <p>📞 {partner.phone}</p>
                <p>🎯 {partner.totalIndications} indicações</p>
                <p>💰 R$ {partner.totalCommission.toFixed(2)}</p>
                <p>💳 Carteira: R$ {partner.walletBalance.toFixed(2)}</p>
              </div>
              <Button className="w-full mt-3 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90">
                <Eye className="w-4 h-4 mr-2" />
                Ver Detalhes
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Partner Details Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] p-6 text-white sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedPartner.photo || "/placeholder.svg"}
                    alt={selectedPartner.name}
                    className="w-16 h-16 rounded-full border-4 border-white"
                  />
                  <div>
                    <h3 className="text-2xl font-bold">{selectedPartner.name}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 bg-white/20`}>
                      {selectedPartner.level}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Contact Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold text-[#3E2415] mb-3">Dados Cadastrais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <p>
                    <span className="font-semibold">Email:</span> {selectedPartner.email}
                  </p>
                  <p>
                    <span className="font-semibold">Telefone:</span> {selectedPartner.phone}
                  </p>
                  <p>
                    <span className="font-semibold">PIX:</span> {selectedPartner.pix}
                  </p>
                  <p>
                    <span className="font-semibold">Cadastro:</span>{" "}
                    {new Date(selectedPartner.registerDate).toLocaleDateString("pt-BR")}
                  </p>
                  <p>
                    <span className="font-semibold">Última indicação:</span>{" "}
                    {new Date(selectedPartner.lastIndication).toLocaleDateString("pt-BR")}
                  </p>
                  <p>
                    <span className="font-semibold">Total indicações:</span> {selectedPartner.totalIndications}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  onClick={() => setShowWalletModal(true)}
                  className="bg-gradient-to-r from-[#3E2415] to-[#FFC800] text-white hover:opacity-90"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Ver Carteira
                </Button>
                <Button
                  onClick={() => setShowLevelChangeModal(true)}
                  className="bg-gradient-to-r from-[#FFC800] to-[#F58220] text-white hover:opacity-90"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Mudar Nível
                </Button>
                <Button
                  variant="outline"
                  className="border-[#F58220] text-[#F58220] hover:bg-[#F58220] hover:text-white bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Extrair Relatórios
                </Button>
              </div>

              {/* Reports */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <h4 className="font-bold text-[#3E2415] mb-3">Relatório de Indicações</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      Total de indicações: <span className="font-semibold">{selectedPartner.totalIndications}</span>
                    </p>
                    <p>
                      Indicações ativas: <span className="font-semibold">{selectedPartner.activeIndications}</span>
                    </p>
                    <p>
                      Comissão total:{" "}
                      <span className="font-semibold text-green-600">
                        R$ {selectedPartner.totalCommission.toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-3 text-[#3E2415] border-[#3E2415] bg-transparent"
                    onClick={() => handleExportIndicationsReport(selectedPartner)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Extrair PDF
                  </Button>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <h4 className="font-bold text-[#3E2415] mb-3">Relatório de QR Codes</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      QR Codes gerados: <span className="font-semibold">23</span>
                    </p>
                    <p>
                      QR Codes utilizados: <span className="font-semibold">18</span>
                    </p>
                    <p>
                      Taxa de utilização: <span className="font-semibold">78%</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-3 text-[#3E2415] border-[#3E2415] bg-transparent"
                    onClick={() => handleExportQRCodesReport(selectedPartner)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Extrair PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#3E2415] to-[#FFC800] p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">Carteira</h3>
                  <p className="opacity-90">{selectedPartner.name}</p>
                </div>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <p className="text-sm opacity-90">Saldo Disponível</p>
                <p className="text-4xl font-bold">R$ {selectedPartner.walletBalance.toFixed(2)}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setCreditAction("add")
                    setShowCreditModal(true)
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Crédito
                </Button>
                <Button
                  onClick={() => {
                    setCreditAction("remove")
                    setShowCreditModal(true)
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Remover Crédito
                </Button>
              </div>

              <div>
                <h4 className="font-bold text-[#3E2415] mb-3">Histórico de Transações</h4>
                <div className="space-y-2">
                  {walletTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-sm">{transaction.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <p className={`font-bold ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                        {transaction.amount > 0 ? "+" : ""}R$ {transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit/Debit Modal */}
      {showCreditModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div
              className={`${creditAction === "add" ? "bg-gradient-to-r from-green-600 to-green-700" : "bg-gradient-to-r from-red-600 to-red-700"} p-6 text-white rounded-t-2xl`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {creditAction === "add" ? "Adicionar Crédito" : "Remover Crédito"}
                </h3>
                <button
                  onClick={() => setShowCreditModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  ✕
                </button>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const amount = Number.parseFloat(formData.get("amount") as string)
                const reason = formData.get("reason") as string
                handleWalletAction(selectedPartner.id, creditAction, amount, reason)
              }}
              className="p-6 space-y-4"
            >
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Valor (R$)</Label>
                <Input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Justificativa</Label>
                <Textarea name="reason" required placeholder="Descreva o motivo desta operação..." rows={4} />
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Anexar Comprovante (opcional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#F58220] transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Clique para selecionar arquivo</p>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowCreditModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className={`flex-1 ${creditAction === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}
                >
                  Confirmar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Level Change Modal */}
      {showLevelChangeModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#FFC800] to-[#F58220] p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Mudar Nível Manualmente</h3>
                <button
                  onClick={() => setShowLevelChangeModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  ✕
                </button>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const newLevel = formData.get("level") as string
                const endDate = formData.get("endDate") as string
                handleChangeLevelManually(selectedPartner.id, newLevel, endDate)
              }}
              className="p-6 space-y-4"
            >
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <p>
                  ⚠️ Esta mudança é temporária. O parceiro retornará ao nível calculado automaticamente após a data
                  definida.
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Nível Atual</Label>
                <Input value={selectedPartner.level} disabled className="bg-gray-100" />
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Novo Nível</Label>
                <select
                  name="level"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F58220] focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="Diamante">Diamante</option>
                  <option value="Ouro">Ouro</option>
                  <option value="Prata">Prata</option>
                </select>
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Data de Término</Label>
                <Input type="date" name="endDate" required min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Justificativa</Label>
                <Textarea name="reason" required placeholder="Motivo da mudança de nível..." rows={3} />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLevelChangeModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-to-r from-[#FFC800] to-[#F58220] text-white">
                  Confirmar Mudança
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
