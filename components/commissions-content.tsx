"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { DollarSign, Clock, CheckCircle, XCircle, Eye, CreditCard, AlertTriangle, Plus, Upload } from "lucide-react"

type CommissionStatus = "awaiting_value" | "pending" | "approved" | "paid" | "rejected"
type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid"

interface Commission {
  id: string
  partnerName: string
  clientName: string
  amount: number
  commissionValue: number
  date: string
  status: CommissionStatus
  unit: string
  qrCodeId?: string
  promotionTitle?: string
  acceptedAt?: string
  deadline?: string
  billAttachment?: string
  customerPhone?: string
}

interface Withdrawal {
  id: string
  partnerName: string
  amount: number
  requestDate: string
  status: WithdrawalStatus
  pixKey?: string
  bankAccount?: string
  rejectionReason?: string
}

interface CommissionsContentProps {
  onAddCommission?: (commission: Commission) => void
}

export function CommissionsContent({ onAddCommission }: CommissionsContentProps) {
  const [activeTab, setActiveTab] = useState<"commissions" | "withdrawals">("commissions")
  const [filterStatus, setFilterStatus] = useState<"all" | CommissionStatus>("all")
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showRejectWithdrawalModal, setShowRejectWithdrawalModal] = useState(false)
  // Corrected type for withdrawalToReject
  const [withdrawalToReject, setWithdrawalToReject] = useState<Withdrawal | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showWithdrawalDetails, setShowWithdrawalDetails] = useState(false)
  const [showBillValueModal, setShowBillValueModal] = useState(false)
  const [billValue, setBillValue] = useState("")
  const [billAttachment, setBillAttachment] = useState<File | null>(null)
  const [showAddManualCommission, setShowAddManualCommission] = useState(false)
  const [manualCommissionData, setManualCommissionData] = useState({
    partnerName: "",
    amount: "",
    reason: "",
  })

  const [commissions, setCommissions] = useState<Commission[]>([
    {
      id: "COM001",
      partnerName: "João Silva",
      clientName: "Maria Santos",
      amount: 250.0,
      commissionValue: 25.0,
      date: "2024-01-15",
      status: "pending",
      unit: "Nomad's Jeri - Principal",
    },
    {
      id: "COM002",
      partnerName: "Ana Costa",
      clientName: "Pedro Oliveira",
      amount: 480.0,
      commissionValue: 48.0,
      date: "2024-01-14",
      status: "approved",
      unit: "Nomad's Jeri - Principal",
    },
    {
      id: "COM003",
      partnerName: "Carlos Mendes",
      clientName: "Julia Ferreira",
      amount: 320.0,
      commissionValue: 32.0,
      date: "2024-01-10",
      status: "paid",
      unit: "Nomad's Jeri - Principal",
    },
  ])

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([
    {
      id: "SAQ001",
      partnerName: "João Silva",
      amount: 150.0,
      requestDate: "2024-01-16",
      status: "pending",
      pixKey: "joao.silva@email.com",
    },
    {
      id: "SAQ002",
      partnerName: "Ana Costa",
      amount: 300.0,
      requestDate: "2024-01-14",
      status: "approved",
      bankAccount: "Banco XYZ - Ag: 1234 - CC: 56789-0",
    },
    {
      id: "SAQ003",
      partnerName: "Carlos Mendes",
      amount: 200.0,
      requestDate: "2024-01-10",
      status: "paid",
      pixKey: "123.456.789-00",
    },
  ])

  const handleSubmitBillValue = () => {
    if (selectedCommission && billValue && billAttachment) {
      const value = Number.parseFloat(billValue)
      const commissionPercent = 10 // Get from partner program
      const commissionValue = value * (commissionPercent / 100)

      setCommissions(
        commissions.map((c) =>
          c.id === selectedCommission.id
            ? {
                ...c,
                amount: value,
                commissionValue: commissionValue,
                status: "pending" as CommissionStatus,
                billAttachment: billAttachment.name,
              }
            : c,
        ),
      )

      setShowBillValueModal(false)
      setSelectedCommission(null)
      setBillValue("")
      setBillAttachment(null)

      alert("✅ Valor da conta registrado! Comissão calculada e aguarda aprovação.")
    }
  }

  const handleAddManualCommission = () => {
    if (manualCommissionData.partnerName && manualCommissionData.amount && manualCommissionData.reason) {
      const value = Number.parseFloat(manualCommissionData.amount)

      const newCommission: Commission = {
        id: `COM-MANUAL-${Date.now()}`,
        partnerName: manualCommissionData.partnerName,
        clientName: `Comissão Adicional: ${manualCommissionData.reason}`,
        amount: 0,
        commissionValue: value,
        date: new Date().toISOString().split("T")[0],
        status: "approved",
        unit: "Manual",
      }

      setCommissions([newCommission, ...commissions])
      setShowAddManualCommission(false)
      setManualCommissionData({ partnerName: "", amount: "", reason: "" })

      alert("✅ Comissão adicional registrada com sucesso!")
      if (onAddCommission) {
        onAddCommission(newCommission)
      }
    }
  }

  // Added optional chaining for deadline in isDeadlineApproaching and isDeadlinePassed
  const isDeadlineApproaching = (deadline?: string) => {
    if (!deadline) return false
    const hoursLeft = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    return hoursLeft <= 6 && hoursLeft > 0
  }

  const isDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false
    return new Date(deadline).getTime() < Date.now()
  }

  // Updated to change status from pending to approved (releases to partner wallet) and added alerts
  const handleApproveCommission = (id: string) => {
    setCommissions(commissions.map((c) => (c.id === id ? { ...c, status: "approved" as CommissionStatus } : c)))
    alert("✅ Comissão aprovada e liberada na carteira do parceiro! O parceiro pode solicitar saque agora.")
  }

  const handleMarkAsPaid = (id: string) => {
    setCommissions(commissions.map((c) => (c.id === id ? { ...c, status: "paid" as CommissionStatus } : c)))
  }

  const handleRejectCommission = () => {
    if (selectedCommission && rejectionReason) {
      setCommissions(
        commissions.map((c) => (c.id === selectedCommission.id ? { ...c, status: "rejected" as CommissionStatus } : c)),
      )
      setShowRejectModal(false)
      setRejectionReason("")
      setSelectedCommission(null)
      alert("❌ Comissão reprovada. Não será liberada na carteira do parceiro.")
    }
  }

  const handleApproveWithdrawal = (id: string) => {
    setWithdrawals(withdrawals.map((w) => (w.id === id ? { ...w, status: "approved" as WithdrawalStatus } : w)))
  }

  const handleMarkWithdrawalAsPaid = (id: string) => {
    setWithdrawals(withdrawals.map((w) => (w.id === id ? { ...w, status: "paid" as WithdrawalStatus } : w)))
  }

  const handleRejectWithdrawal = (id: string, reason: string) => {
    setWithdrawals(
      withdrawals.map((w) =>
        w.id === id ? { ...w, status: "rejected" as WithdrawalStatus, rejectionReason: reason } : w,
      ),
    )
  }

  const confirmRejectWithdrawal = () => {
    if (withdrawalToReject && rejectionReason) {
      handleRejectWithdrawal(withdrawalToReject.id, rejectionReason)
      setShowRejectWithdrawalModal(false)
      setRejectionReason("")
      setWithdrawalToReject(null)
    }
  }

  const getStatusBadge = (status: CommissionStatus | WithdrawalStatus) => {
    const statusConfig = {
      awaiting_value: { bg: "bg-orange-100", text: "text-orange-800", label: "Aguardando Valor" },
      pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Aguardando Aprovação" },
      approved: { bg: "bg-blue-100", text: "text-blue-800", label: "Aprovado (Na Carteira)" },
      paid: { bg: "bg-green-100", text: "text-green-800", label: "Pago" },
      rejected: { bg: "bg-red-100", text: "text-red-800", label: "Reprovado" },
    }
    // Added type assertion for status to access statusConfig safely
    const config = statusConfig[status as keyof typeof statusConfig]
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>{config.label}</span>
    )
  }

  const totalInWallet = commissions
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.commissionValue, 0)
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.commissionValue, 0)
  // Adjusted totalPending to include awaiting_value commissions
  const totalPending = commissions
    .filter((c) => c.status === "pending" || c.status === "awaiting_value")
    .reduce((sum, c) => sum + c.commissionValue, 0)

  const filteredCommissions =
    filterStatus === "all" ? commissions : commissions.filter((c) => c.status === filterStatus)

  const awaitingValueCount = commissions.filter((c) => c.status === "awaiting_value").length

  return (
    <div className="space-y-6">
      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#FFC800] to-[#F58220] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Em Carteira</span>
          </div>
          <p className="text-3xl font-bold">R$ {totalInWallet.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-[#3E2415] to-[#3E2415] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Pagas</span>
          </div>
          <p className="text-3xl font-bold">R$ {totalPaid.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Pendentes</span>
          </div>
          <p className="text-3xl font-bold">R$ {totalPending.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddManualCommission(true)}
          className="bg-gradient-to-r from-[#3E2415] to-[#3E2415] hover:opacity-90 text-white rounded-xl shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Comissão Adicional
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("commissions")}
            className={`flex-1 px-6 py-4 font-semibold transition-colors relative ${
              activeTab === "commissions"
                ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Comissões
            {awaitingValueCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                {awaitingValueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("withdrawals")}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === "withdrawals"
                ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Saques
          </button>
        </div>

        {/* Commissions Tab */}
        {activeTab === "commissions" && (
          <div className="p-6">
            <div className="mb-6 flex flex-wrap gap-2">
              {["all", "awaiting_value", "pending", "approved", "paid", "rejected"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as typeof filterStatus)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filterStatus === status
                      ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status === "all"
                    ? "Todos"
                    : status === "awaiting_value"
                      ? "Aguardando Valor"
                      : status === "pending"
                        ? "Aguardando Aprovação"
                        : status === "approved"
                          ? "Aprovadas"
                          : status === "paid"
                            ? "Pagas"
                            : "Reprovadas"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredCommissions.map((commission) => {
                const isAwaitingValue = commission.status === "awaiting_value"
                const approaching = isDeadlineApproaching(commission.deadline)
                const passed = isDeadlinePassed(commission.deadline)

                return (
                  <div
                    key={commission.id}
                    className={`rounded-xl p-4 border-2 transition-all ${
                      isAwaitingValue && passed
                        ? "bg-red-50 border-red-500 animate-pulse"
                        : isAwaitingValue && approaching
                          ? "bg-yellow-50 border-yellow-500"
                          : isAwaitingValue
                            ? "bg-orange-50 border-orange-300"
                            : "bg-gradient-to-r from-[#FFF5E6] to-[#E8F4F8] border-gray-200"
                    } hover:shadow-md transition-shadow`}
                  >
                    {isAwaitingValue && passed && (
                      <div className="flex items-center gap-2 mb-3 text-red-700 font-bold">
                        <AlertTriangle className="w-5 h-5" />
                        <span>PRAZO EXPIRADO! Insira o valor imediatamente</span>
                      </div>
                    )}
                    {isAwaitingValue && approaching && !passed && (
                      <div className="flex items-center gap-2 mb-3 text-yellow-700 font-semibold">
                        <Clock className="w-5 h-5" />
                        <span>Prazo se aproximando! Menos de 6 horas restantes</span>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] flex items-center justify-center text-white font-bold">
                            {commission.partnerName[0]}
                          </div>
                          <div>
                            <h4 className="font-bold text-[#3E2415]">{commission.partnerName}</h4>
                            <p className="text-sm text-gray-600">Cliente: {commission.clientName}</p>
                          </div>
                        </div>

                        {isAwaitingValue ? (
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-600">
                              <span className="font-semibold">Promoção:</span> {commission.promotionTitle}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-semibold">QR Code:</span> {commission.qrCodeId}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-semibold">Aceito em:</span>{" "}
                              {commission.acceptedAt && new Date(commission.acceptedAt).toLocaleString("pt-BR")}
                            </p>
                            <p
                              className={`font-semibold ${passed ? "text-red-600" : approaching ? "text-yellow-700" : "text-gray-700"}`}
                            >
                              <span>Prazo:</span>{" "}
                              {commission.deadline && new Date(commission.deadline).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-600">
                              <span className="font-semibold">ID:</span> {commission.id}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-semibold">Unidade:</span> {commission.unit}
                            </p>
                            {commission.amount > 0 && (
                              <p className="text-gray-600">
                                <span className="font-semibold">Valor da Conta:</span> R$ {commission.amount.toFixed(2)}
                              </p>
                            )}
                            <p className="text-gray-600">
                              <span className="font-semibold">Data:</span> {commission.date}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        {getStatusBadge(commission.status)}
                        {!isAwaitingValue && (
                          <p className="text-2xl font-bold text-[#3E2415]">
                            R$ {commission.commissionValue.toFixed(2)}
                          </p>
                        )}

                        <div className="flex gap-2">
                          {isAwaitingValue && (
                            <Button
                              onClick={() => {
                                setSelectedCommission(commission)
                                setShowBillValueModal(true)
                              }}
                              className={`${
                                passed
                                  ? "bg-gradient-to-r from-red-600 to-red-700 animate-pulse"
                                  : "bg-gradient-to-r from-[#3E2415] to-[#3E2415]"
                              } hover:opacity-90 text-white`}
                            >
                              <DollarSign className="w-4 h-4 mr-2" />
                              Inserir Valor
                            </Button>
                          )}

                          {commission.status === "pending" && (
                            <>
                              <Button
                                onClick={() => handleApproveCommission(commission.id)}
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Aprovar
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedCommission(commission)
                                  setShowRejectModal(true)
                                }}
                                className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90 text-white"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reprovar
                              </Button>
                            </>
                          )}

                          {/* Removed "Marcar como Pago" button from approved commissions */}
                          {/* {commission.status === "approved" && (
                            <Button
                              onClick={() => handleMarkAsPaid(commission.id)}
                              className="bg-gradient-to-r from-[#3E2415] to-[#3E2415] hover:opacity-90 text-white"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Marcar como Pago
                            </Button>
                          )} */}

                          <Button
                            onClick={() => setSelectedCommission(commission)}
                            className="bg-gray-500 hover:bg-gray-600 text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === "withdrawals" && (
          <div className="p-6">
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="bg-gradient-to-r from-[#FFF5E6] to-[#E8F4F8] rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3E2415] to-[#3E2415] flex items-center justify-center text-white font-bold">
                          {withdrawal.partnerName[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-[#3E2415]">{withdrawal.partnerName}</h4>
                          <p className="text-sm text-gray-600">ID: {withdrawal.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          Valor: <span className="font-bold text-[#F58220]">R$ {withdrawal.amount.toFixed(2)}</span>
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(withdrawal.requestDate).toLocaleDateString()}
                        </span>
                      </div>
                      {withdrawal.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs text-red-700">
                            <strong>Motivo da reprovação:</strong> {withdrawal.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(withdrawal.status)}
                      <Button
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal)
                          setShowWithdrawalDetails(true)
                        }}
                        variant="outline"
                        className="border-[#3E2415] text-[#3E2415] hover:bg-blue-50"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Detalhes
                      </Button>
                      {withdrawal.status === "pending" && (
                        <>
                          <Button
                            onClick={() => handleApproveWithdrawal(withdrawal.id)}
                            className="bg-gradient-to-r from-[#3E2415] to-[#3E2415] hover:opacity-90 text-white"
                            size="sm"
                          >
                            Aprovar
                          </Button>
                          <Button
                            onClick={() => {
                              setWithdrawalToReject(withdrawal)
                              setShowRejectWithdrawalModal(true)
                            }}
                            variant="outline"
                            className="border-red-500 text-red-600 hover:bg-red-50"
                            size="sm"
                          >
                            Reprovar
                          </Button>
                        </>
                      )}
                      {withdrawal.status === "approved" && (
                        <Button
                          onClick={() => handleMarkWithdrawalAsPaid(withdrawal.id)}
                          className="bg-gradient-to-r from-green-600 to-green-700 hover:opacity-90 text-white"
                          size="sm"
                        >
                          Marcar como Pago
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject Commission Modal */}
      {showRejectModal && selectedCommission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <XCircle className="w-6 h-6" />
                Reprovar Comissão
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Parceiro: <span className="font-semibold text-[#3E2415]">{selectedCommission.partnerName}</span>
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Valor:{" "}
                  <span className="font-bold text-[#F58220]">R$ {selectedCommission.commissionValue.toFixed(2)}</span>
                </p>
              </div>
              <div>
                <Label>Motivo da Reprovação</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Digite o motivo da reprovação..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleRejectCommission}
                  disabled={!rejectionReason}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:opacity-90 text-white"
                >
                  Confirmar Reprovação
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectionReason("")
                    setSelectedCommission(null)
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Details Modal */}
      {showWithdrawalDetails && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#3E2415] to-[#3E2415] p-6 text-white">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <CreditCard className="w-6 h-6" />
                Detalhes do Saque
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3E2415] to-[#3E2415] flex items-center justify-center text-white font-bold text-lg">
                  {selectedWithdrawal.partnerName[0]}
                </div>
                <div>
                  <h4 className="font-bold text-[#3E2415]">{selectedWithdrawal.partnerName}</h4>
                  <p className="text-sm text-gray-600">{selectedWithdrawal.id}</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-[#FFF5E6] to-[#E8F4F8] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Valor Solicitado:</span>
                  <span className="font-bold text-xl text-[#F58220]">R$ {selectedWithdrawal.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Data da Solicitação:</span>
                  <span className="font-semibold text-[#3E2415]">
                    {new Date(selectedWithdrawal.requestDate).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  {getStatusBadge(selectedWithdrawal.status)}
                </div>
              </div>

              <div className="border-t pt-4">
                <h5 className="font-bold text-[#3E2415] mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Dados para Pagamento
                </h5>
                {selectedWithdrawal.pixKey && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-2">
                    <p className="text-xs text-gray-600 mb-1">Chave PIX:</p>
                    <p className="font-mono font-semibold text-[#3E2415]">{selectedWithdrawal.pixKey}</p>
                  </div>
                )}
                {selectedWithdrawal.bankAccount && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Conta Bancária:</p>
                    <p className="font-mono text-sm font-semibold text-[#3E2415]">{selectedWithdrawal.bankAccount}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => {
                  setShowWithdrawalDetails(false)
                  setSelectedWithdrawal(null)
                }}
                className="w-full bg-gradient-to-r from-[#3E2415] to-[#3E2415] hover:opacity-90 text-white"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Withdrawal Modal */}
      {showRejectWithdrawalModal && withdrawalToReject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <XCircle className="w-6 h-6" />
                Reprovar Saque
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Parceiro: <span className="font-semibold text-[#3E2415]">{withdrawalToReject.partnerName}</span>
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Valor: <span className="font-bold text-[#F58220]">R$ {withdrawalToReject.amount.toFixed(2)}</span>
                </p>
              </div>
              <div>
                <Label>Motivo da Reprovação</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Digite o motivo da reprovação do saque..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={confirmRejectWithdrawal}
                  disabled={!rejectionReason}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:opacity-90 text-white"
                >
                  Confirmar Reprovação
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectWithdrawalModal(false)
                    setRejectionReason("")
                    setWithdrawalToReject(null)
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Updated Bill Value Modal */}
      {showBillValueModal && selectedCommission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Updated modal header */}
            <div className="bg-gradient-to-r from-[#3E2415] to-[#3E2415] p-6 text-white">
              <h3 className="text-2xl font-bold">Inserir Valor da Conta</h3>
              <p className="text-sm opacity-90 mt-1">Cliente: {selectedCommission.clientName}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label>Valor Total da Conta (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={billValue}
                  onChange={(e) => setBillValue(e.target.value)}
                  placeholder="Ex: 250.00"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Anexar Cupom Fiscal / Foto da Conta *</Label>
                <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-[#F58220] transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setBillAttachment(e.target.files?.[0] || null)}
                    className="hidden"
                    id="bill-upload"
                  />
                  <label htmlFor="bill-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      {billAttachment ? billAttachment.name : "Clique para enviar (JPG, PNG, PDF)"}
                    </p>
                  </label>
                </div>
              </div>

              {billValue && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Comissão calculada (10%):</span> R${" "}
                    {(Number.parseFloat(billValue) * 0.1).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 bg-gray-50">
              <Button
                onClick={() => {
                  setShowBillValueModal(false)
                  setSelectedCommission(null)
                  setBillValue("")
                  setBillAttachment(null)
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitBillValue}
                disabled={!billValue || !billAttachment}
                className="flex-1 bg-gradient-to-r from-[#3E2415] to-[#3E2415] hover:opacity-90 text-white disabled:opacity-50"
              >
                Confirmar e Calcular Comissão
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddManualCommission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#3E2415] to-[#3E2415] p-6 text-white">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Plus className="w-6 h-6" />
                Adicionar Comissão Adicional
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Use para adicionar comissões extras, bônus ou ajustes manuais na carteira do parceiro
              </p>

              <div>
                <Label htmlFor="manualPartnerName">Nome do Parceiro *</Label>
                <Input
                  id="manualPartnerName"
                  value={manualCommissionData.partnerName}
                  onChange={(e) => setManualCommissionData({ ...manualCommissionData, partnerName: e.target.value })}
                  placeholder="Digite o nome do parceiro"
                />
              </div>

              <div>
                <Label htmlFor="manualAmount">Valor da Comissão (R$) *</Label>
                <Input
                  id="manualAmount"
                  type="number"
                  step="0.01"
                  value={manualCommissionData.amount}
                  onChange={(e) => setManualCommissionData({ ...manualCommissionData, amount: e.target.value })}
                  placeholder="0,00"
                  className="text-lg font-semibold"
                />
              </div>

              <div>
                <Label htmlFor="manualReason">Motivo / Descrição *</Label>
                <Textarea
                  id="manualReason"
                  value={manualCommissionData.reason}
                  onChange={(e) => setManualCommissionData({ ...manualCommissionData, reason: e.target.value })}
                  placeholder="Ex: Bônus por atingir meta, Ajuste de comissão anterior..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleAddManualCommission}
                  disabled={
                    !manualCommissionData.partnerName || !manualCommissionData.amount || !manualCommissionData.reason
                  }
                  className="flex-1 bg-gradient-to-r from-[#3E2415] to-[#3E2415] hover:opacity-90 text-white disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Adicionar Comissão
                </Button>
                <Button
                  onClick={() => {
                    setShowAddManualCommission(false)
                    setManualCommissionData({ partnerName: "", amount: "", reason: "" })
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
