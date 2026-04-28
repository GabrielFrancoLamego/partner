"use client"

import { useState } from "react"
import { TrendingUp, Wallet, CheckCircle, Users, Calendar, MapPin, CalendarRange, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RegisterCommissionModal } from "./register-commission-modal"
import { CustomDateRangeModal } from "./custom-date-range-modal"

export function DashboardContent() {
  const [dateRange, setDateRange] = useState("today")
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)
  const [customDates, setCustomDates] = useState<{ start: string; end: string } | null>(null)
  const [selectedReferral, setSelectedReferral] = useState<any>(null)
  const [registeredCommissions, setRegisteredCommissions] = useState<any[]>([])

  const [activeReferrals, setActiveReferrals] = useState([
    {
      id: 1,
      name: "Maria Silva",
      partnerId: "João Costa",
      program: "Premium 15%",
      tableNumber: "12",
      arrivedAt: "18:45",
      status: "dining",
      avatar: "/placeholder.svg?height=40&width=40",
    },
    {
      id: 2,
      name: "Pedro Santos",
      partnerId: "Ana Lima",
      program: "Standard 10%",
      tableNumber: "8",
      arrivedAt: "19:20",
      status: "dining",
      avatar: "/placeholder.svg?height=40&width=40",
    },
    {
      id: 3,
      name: "Juliana Oliveira",
      partnerId: "Carlos Mendes",
      program: "VIP 20%",
      tableNumber: "5",
      arrivedAt: "19:30",
      status: "dining",
      avatar: "/placeholder.svg?height=40&width=40",
    },
  ])

  const getStats = (range: string) => {
    let mult = 1

    if (range === "custom" && customDates) {
      const start = new Date(customDates.start)
      const end = new Date(customDates.end)
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      mult = diffDays
    } else {
      const multipliers: Record<string, number> = {
        today: 1,
        week: 7,
        month: 30,
        year: 365,
      }
      mult = multipliers[range] || 1
    }

    return [
      {
        title: "Indicações do período",
        value: `${24 * mult}`,
        change: "+12%",
        icon: TrendingUp,
        color: "from-[#FF7A28] to-[#FFBE3B]",
      },
      {
        title: "Comissões pendentes",
        value: `R$ ${(15.4 * mult).toFixed(1)}k`,
        change: "+8%",
        icon: Wallet,
        color: "from-[#0078B7] to-[#00A3E0]",
      },
      {
        title: "Comissões pagas",
        value: `R$ ${(87.2 * mult).toFixed(1)}k`,
        change: "+23%",
        icon: CheckCircle,
        color: "from-[#FFBE3B] to-[#FFD700]",
      },
      {
        title: "Parceiros ativos",
        value: `${142 + mult * 5}`,
        change: "+5%",
        icon: Users,
        color: "from-[#FF7A28] to-[#FF5A00]",
      },
    ]
  }

  const stats = getStats(dateRange)

  const handleCustomDateRange = (start: string, end: string) => {
    setCustomDates({ start, end })
    setDateRange("custom")
    setShowCustomDateRange(false)
  }

  const handleRegisterCommission = (referralId: number, commissionData: any) => {
    const referral = activeReferrals.find((r) => r.id === referralId)
    if (referral) {
      // Add to registered commissions
      setRegisteredCommissions((prev) => [
        {
          ...referral,
          ...commissionData,
          registeredAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ])
      // Remove from active referrals
      setActiveReferrals((prev) => prev.filter((r) => r.id !== referralId))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#0A2E4D]">Dashboard da Empresa</h2>
          <p className="text-gray-600 mt-1 text-sm">Resumo geral das indicações e programas</p>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-md border border-gray-100">
          <Button
            size="sm"
            variant={dateRange === "today" ? "default" : "ghost"}
            onClick={() => setDateRange("today")}
            className={`text-xs ${
              dateRange === "today"
                ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-3 h-3 mr-1" />
            Hoje
          </Button>
          <Button
            size="sm"
            variant={dateRange === "week" ? "default" : "ghost"}
            onClick={() => setDateRange("week")}
            className={`text-xs ${
              dateRange === "week"
                ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            7 dias
          </Button>
          <Button
            size="sm"
            variant={dateRange === "month" ? "default" : "ghost"}
            onClick={() => setDateRange("month")}
            className={`text-xs ${
              dateRange === "month"
                ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            30 dias
          </Button>
          <Button
            size="sm"
            variant={dateRange === "year" ? "default" : "ghost"}
            onClick={() => setDateRange("year")}
            className={`text-xs ${
              dateRange === "year"
                ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Ano
          </Button>
          <Button
            size="sm"
            variant={dateRange === "custom" ? "default" : "ghost"}
            onClick={() => setShowCustomDateRange(true)}
            className={`text-xs ${
              dateRange === "custom"
                ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <CalendarRange className="w-3 h-3 mr-1" />
            Personalizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-md`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-gray-600 text-xs font-medium mb-1">{stat.title}</h3>
              <p className="text-xl font-bold text-[#0A2E4D]">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Active Referrals Section */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0A2E4D]">Indicações Ativas Agora</h3>
              <p className="text-xs text-gray-600">{activeReferrals.length} clientes no restaurante</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-green-600">Tempo Real</span>
          </div>
        </div>

        <div className="space-y-3">
          {activeReferrals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma indicação ativa no momento</p>
            </div>
          ) : (
            activeReferrals.map((referral) => (
              <div
                key={referral.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:shadow-md transition-all"
              >
                <img
                  src={referral.avatar || "/placeholder.svg"}
                  alt={referral.name}
                  className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0A2E4D] text-sm">{referral.name}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-600">
                      Indicado por: <span className="font-medium text-[#0078B7]">{referral.partnerId}</span>
                    </span>
                    <span className="text-xs bg-[#FFBE3B] text-[#0A2E4D] px-2 py-0.5 rounded-full font-medium">
                      {referral.program}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                    <span>Mesa {referral.tableNumber}</span>
                    <span>•</span>
                    <span>Chegou às {referral.arrivedAt}</span>
                  </div>
                </div>
                <Button
                  onClick={() => setSelectedReferral(referral)}
                  className="bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90 shadow-md text-xs h-9 px-4"
                >
                  Registrar Comissão
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Registered Commissions Section */}
      {registeredCommissions.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-[#FF7A28] to-[#FFBE3B] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0A2E4D]">Comissões Registradas</h3>
              <p className="text-xs text-gray-600">{registeredCommissions.length} registro(s) recente(s)</p>
            </div>
          </div>

          <div className="space-y-3">
            {registeredCommissions.map((commission, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200"
              >
                <img
                  src={commission.avatar || "/placeholder.svg"}
                  alt={commission.name}
                  className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0A2E4D] text-sm">{commission.name}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-600">
                      Por: <span className="font-medium text-[#0078B7]">{commission.partnerId}</span>
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      R$ {commission.commissionValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>Registrado às {commission.registeredAt}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Conta Total</p>
                  <p className="text-lg font-bold text-[#0A2E4D]">R$ {commission.billAmount.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <h3 className="text-lg font-bold text-[#0A2E4D] mb-4">Atividade Recente</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 bg-gradient-to-br from-[#0078B7] to-[#00A3E0] rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-[#0A2E4D] text-sm">Nova indicação registrada</p>
                <p className="text-xs text-gray-600">Parceiro João Silva - há 2 horas</p>
              </div>
              <span className="text-xs font-semibold text-[#FF7A28]">R$ 450</span>
            </div>
          ))}
        </div>
      </div>

      {selectedReferral && (
        <RegisterCommissionModal
          referral={selectedReferral}
          isOpen={!!selectedReferral}
          onClose={() => setSelectedReferral(null)}
          onRegister={handleRegisterCommission}
        />
      )}

      {showCustomDateRange && (
        <CustomDateRangeModal
          isOpen={showCustomDateRange}
          onClose={() => setShowCustomDateRange(false)}
          onApply={handleCustomDateRange}
        />
      )}
    </div>
  )
}
