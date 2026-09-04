"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, Gift, QrCode, MapPin, Calendar, Package } from "lucide-react"
import { Button } from "./ui/button"
import { AddPromotionModal } from "./add-promotion-modal"

export type Promotion = {
  id: string
  title: string
  description: string
  bannerUrl: string
  validFrom: string
  validUntil: string
  qrCodeValidityMinutes: number
  stock: number | null // null = unlimited
  cost: number
  linkedUnits: string[] // empty = all units
  usedCount: number
  createdAt: string
}

export function PromotionsContent() {
  const [promotions, setPromotions] = useState<Promotion[]>([
    {
      id: "1",
      title: "Happy Hour Especial",
      description: "Desconto de 30% em todas as bebidas das 17h às 19h",
      bannerUrl: "/happy-hour-drinks.png",
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      qrCodeValidityMinutes: 15,
      stock: 100,
      cost: 25.0,
      linkedUnits: [], // todas as unidades
      usedCount: 23,
      createdAt: "2024-01-10",
    },
  ])

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)

  const handleAddPromotion = (promotion: Promotion) => {
    setPromotions([
      ...promotions,
      { ...promotion, id: Date.now().toString(), createdAt: new Date().toISOString(), usedCount: 0 },
    ])
  }

  const handleEditPromotion = (promotion: Promotion) => {
    setPromotions(promotions.map((p) => (p.id === promotion.id ? promotion : p)))
  }

  const handleDeletePromotion = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta promoção?")) {
      setPromotions(promotions.filter((p) => p.id !== id))
    }
  }

  const openEditModal = (promotion: Promotion) => {
    setEditingPromotion(promotion)
    setIsAddModalOpen(true)
  }

  const calculateTotalCost = (promotion: Promotion) => {
    return promotion.usedCount * promotion.cost
  }

  const getStockStatus = (promotion: Promotion) => {
    if (promotion.stock === null) return "Ilimitado"
    const remaining = promotion.stock - promotion.usedCount
    return `${remaining}/${promotion.stock}`
  }

  const getStockColor = (promotion: Promotion) => {
    if (promotion.stock === null) return "text-green-600"
    const remaining = promotion.stock - promotion.usedCount
    const percentage = (remaining / promotion.stock) * 100
    if (percentage > 50) return "text-green-600"
    if (percentage > 20) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3E2415]">Promoções</h2>
          <p className="text-sm text-gray-600 mt-1">Gerencie promoções com QR Code para seus parceiros e clientes</p>
        </div>
        <Button
          onClick={() => {
            setEditingPromotion(null)
            setIsAddModalOpen(true)
          }}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl px-6 shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Promoção
        </Button>
      </div>

      {/* Promotions Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {promotions.map((promotion) => {
          const isActive = new Date(promotion.validUntil) >= new Date()
          const stockRemaining = promotion.stock === null ? null : promotion.stock - promotion.usedCount

          return (
            <div
              key={promotion.id}
              className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
            >
              {/* Banner Image */}
              <div className="relative h-40 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800]">
                <img
                  src={promotion.bannerUrl || "/placeholder.svg"}
                  alt={promotion.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  {isActive ? (
                    <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-medium shadow-lg">
                      Ativa
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-500 text-white rounded-full text-xs font-medium shadow-lg">
                      Expirada
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="w-5 h-5 text-[#F58220]" />
                      <h3 className="text-lg font-bold text-[#3E2415]">{promotion.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{promotion.description}</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-[#FFF5E6] to-[#FFE5CC] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-[#F58220]" />
                      <p className="text-xs text-gray-600">Estoque</p>
                    </div>
                    <p className={`text-sm font-bold ${getStockColor(promotion)}`}>{getStockStatus(promotion)}</p>
                  </div>

                  <div className="bg-gradient-to-br from-[#E8F4F8] to-[#D0E7F0] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <QrCode className="w-4 h-4 text-[#3E2415]" />
                      <p className="text-xs text-gray-600">Utilizados</p>
                    </div>
                    <p className="text-sm font-bold text-[#3E2415]">{promotion.usedCount}</p>
                  </div>

                  <div className="bg-gradient-to-br from-[#FFE5E5] to-[#FFD5D5] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-red-500" />
                      <p className="text-xs text-gray-600">QR Válido</p>
                    </div>
                    <p className="text-sm font-bold text-red-500">{promotion.qrCodeValidityMinutes} min</p>
                  </div>

                  <div className="bg-gradient-to-br from-[#E8FFE8] to-[#D0F0D0] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <p className="text-xs text-gray-600">Unidades</p>
                    </div>
                    <p className="text-sm font-bold text-green-600">
                      {promotion.linkedUnits.length === 0 ? "Todas" : promotion.linkedUnits.length}
                    </p>
                  </div>
                </div>

                {/* Cost Info */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">Custo Unitário:</span>
                    <span className="font-semibold text-[#3E2415]">R$ {promotion.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Custo Total Usado:</span>
                    <span className="font-bold text-[#F58220]">R$ {calculateTotalCost(promotion).toFixed(2)}</span>
                  </div>
                </div>

                {/* Validity Period */}
                <div className="text-xs text-gray-500 mb-4 pb-4 border-b border-gray-200">
                  Válido: {new Date(promotion.validFrom).toLocaleDateString("pt-BR")} até{" "}
                  {new Date(promotion.validUntil).toLocaleDateString("pt-BR")}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => openEditModal(promotion)}
                    className="flex-1 bg-[#3E2415] hover:bg-[#2F1B10] text-white rounded-lg"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDeletePromotion(promotion.id)}
                    className="rounded-lg border-red-400 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {promotions.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-md border border-gray-100">
          <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#3E2415] mb-2">Nenhuma promoção cadastrada</h3>
          <p className="text-gray-600 mb-6">Crie sua primeira promoção com QR Code para começar</p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Promoção
          </Button>
        </div>
      )}

      <AddPromotionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingPromotion(null)
        }}
        onSave={editingPromotion ? handleEditPromotion : handleAddPromotion}
        editingPromotion={editingPromotion}
      />
    </div>
  )
}
