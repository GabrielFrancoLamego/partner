"use client"

import { useState } from "react"
import { X, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CustomDateRangeModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (startDate: string, endDate: string) => void
}

export function CustomDateRangeModal({ isOpen, onClose, onApply }: CustomDateRangeModalProps) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  if (!isOpen) return null

  const handleApply = () => {
    if (startDate && endDate) {
      onApply(startDate, endDate)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-[#FF7A28] via-[#FFBE3B] to-[#0078B7] p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Período Personalizado</h2>
              <p className="text-white/80 text-sm mt-1">Selecione o intervalo de datas</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-sm font-semibold text-[#0A2E4D]">
              Data Inicial
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border-2 border-gray-200 focus:border-[#FF7A28] rounded-xl h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-sm font-semibold text-[#0A2E4D]">
              Data Final
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full border-2 border-gray-200 focus:border-[#FF7A28] rounded-xl h-12"
            />
          </div>

          {startDate && endDate && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-[#0A2E4D]">
                <span className="font-semibold">Período selecionado:</span>
                <br />
                {new Date(startDate).toLocaleDateString("pt-BR")} até {new Date(endDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-2 border-gray-200 hover:bg-gray-50 font-semibold bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={!startDate || !endDate}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white hover:opacity-90 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar Filtro
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
