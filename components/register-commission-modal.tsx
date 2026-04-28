"use client"

import type React from "react"

import { useState } from "react"
import { X, Upload, Calculator, Camera, CheckCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RegisterCommissionModalProps {
  referral: {
    id: number
    name: string
    partnerId: string
    program: string
    tableNumber: string
    arrivedAt: string
    avatar: string
  }
  isOpen: boolean
  onClose: () => void
  onRegister: (referralId: number, data: any) => void
}

export function RegisterCommissionModal({ referral, isOpen, onClose, onRegister }: RegisterCommissionModalProps) {
  const [billAmount, setBillAmount] = useState("")
  const [receiptFile, setReceiptFile] = useState<{ url: string; type: string; name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  // Calculate commission based on program
  const getCommissionRate = (program: string) => {
    if (program.includes("20%")) return 0.2
    if (program.includes("15%")) return 0.15
    if (program.includes("10%")) return 0.1
    return 0.1
  }

  const commissionRate = getCommissionRate(referral.program)
  const billValue = Number.parseFloat(billAmount.replace(",", ".")) || 0
  const commissionValue = billValue * commissionRate

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const fileType = file.type
      const fileName = file.name

      if (fileType === "application/pdf") {
        // For PDF, store file info without preview
        setReceiptFile({
          url: URL.createObjectURL(file),
          type: "pdf",
          name: fileName,
        })
      } else {
        // For images, create preview
        const reader = new FileReader()
        reader.onloadend = () => {
          setReceiptFile({
            url: reader.result as string,
            type: "image",
            name: fileName,
          })
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleSubmit = () => {
    setIsSubmitting(true)

    const commissionData = {
      billAmount: billValue,
      commissionRate,
      commissionValue,
      receiptFile,
      registeredAt: new Date().toISOString(),
    }

    setTimeout(() => {
      setIsSubmitting(false)
      onRegister(referral.id, commissionData)
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#FF7A28] via-[#FFBE3B] to-[#0078B7] p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/placeholder.svg?height=200&width=800')] opacity-10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Registrar Comissão</h2>
                <p className="text-white/90 text-sm mt-0.5">Calcule e registre a comissão automaticamente</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Referral Info Card */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 mb-6 border border-orange-200">
            <div className="flex items-center gap-4">
              <img
                src={referral.avatar || "/placeholder.svg"}
                alt={referral.name}
                className="w-16 h-16 rounded-full border-4 border-white shadow-md"
              />
              <div className="flex-1">
                <h3 className="font-bold text-[#0A2E4D] text-lg">{referral.name}</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  Indicado por: <span className="font-semibold text-[#0078B7]">{referral.partnerId}</span>
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs bg-[#FFBE3B] text-[#0A2E4D] px-3 py-1 rounded-full font-semibold">
                    {referral.program}
                  </span>
                  <span className="text-xs text-gray-600">Mesa {referral.tableNumber}</span>
                  <span className="text-xs text-gray-600">• {referral.arrivedAt}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bill Amount Input */}
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="billAmount" className="text-sm font-semibold text-[#0A2E4D] mb-2 block">
                Valor da Conta (R$)
              </Label>
              <Input
                id="billAmount"
                type="text"
                placeholder="0,00"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                className="text-2xl font-bold text-[#0A2E4D] h-16 text-center border-2 border-[#0078B7] focus:border-[#FF7A28] rounded-xl"
              />
            </div>

            {/* Commission Calculation Display */}
            {billValue > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border-2 border-green-200 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Taxa de Comissão:</span>
                  <span className="text-lg font-bold text-[#0078B7]">{(commissionRate * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t-2 border-green-300">
                  <span className="text-base font-semibold text-[#0A2E4D]">Comissão Total:</span>
                  <span className="text-3xl font-bold text-green-600">R$ {commissionValue.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="mb-6">
            <Label className="text-sm font-semibold text-[#0A2E4D] mb-3 block flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto/PDF da Conta (Para confiança e auditoria)
            </Label>
            <div className="relative">
              {receiptFile ? (
                <div className="relative group">
                  {receiptFile.type === "image" ? (
                    <img
                      src={receiptFile.url || "/placeholder.svg"}
                      alt="Receipt"
                      className="w-full h-48 object-cover rounded-xl border-2 border-[#0078B7]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-[#0078B7]">
                      <FileText className="w-16 h-16 text-[#FF7A28] mb-3" />
                      <p className="text-sm font-semibold text-[#0A2E4D]">{receiptFile.name}</p>
                      <p className="text-xs text-gray-600 mt-1">Arquivo PDF anexado</p>
                    </div>
                  )}
                  <button
                    onClick={() => setReceiptFile(null)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#0078B7] rounded-xl hover:border-[#FF7A28] hover:bg-orange-50 transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#0078B7] to-[#00A3E0] rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-[#0A2E4D] mb-1">Clique para fazer upload</p>
                  <p className="text-xs text-gray-600">PNG, JPG ou PDF (máx. 5MB)</p>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-12 text-sm font-semibold border-2 hover:bg-gray-100 bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!billAmount || billValue === 0 || !receiptFile || isSubmitting}
            className="flex-1 h-12 bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90 shadow-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Confirmar Registro
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
