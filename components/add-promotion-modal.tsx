"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X, ImageIcon, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import type { Promotion } from "./promotions-content"

type AddPromotionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (promotion: Promotion) => void
  editingPromotion: Promotion | null
}

export function AddPromotionModal({ isOpen, onClose, onSave, editingPromotion }: AddPromotionModalProps) {
  const [formData, setFormData] = useState<Omit<Promotion, "id" | "createdAt" | "usedCount">>({
    title: "",
    description: "",
    bannerUrl: "",
    validFrom: "",
    validUntil: "",
    qrCodeValidityMinutes: 15,
    stock: null,
    cost: 0,
    linkedUnits: [],
  })

  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [applyToAllUnits, setApplyToAllUnits] = useState(true)

  // Mock units data - in real app, fetch from API
  const availableUnits = [
    { id: "1", name: "Nomad's Jeri - Sede Principal" },
    { id: "2", name: "Nomad's Jeri - Praia" },
    { id: "3", name: "Nomad's Jeri - Centro" },
  ]

  useEffect(() => {
    if (editingPromotion) {
      setFormData({
        title: editingPromotion.title,
        description: editingPromotion.description,
        bannerUrl: editingPromotion.bannerUrl,
        validFrom: editingPromotion.validFrom,
        validUntil: editingPromotion.validUntil,
        qrCodeValidityMinutes: editingPromotion.qrCodeValidityMinutes,
        stock: editingPromotion.stock,
        cost: editingPromotion.cost,
        linkedUnits: editingPromotion.linkedUnits,
      })
      setBannerPreview(editingPromotion.bannerUrl)
      setApplyToAllUnits(editingPromotion.linkedUnits.length === 0)
      setSelectedUnits(editingPromotion.linkedUnits)
    } else {
      resetForm()
    }
  }, [editingPromotion, isOpen])

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      bannerUrl: "",
      validFrom: "",
      validUntil: "",
      qrCodeValidityMinutes: 15,
      stock: null,
      cost: 0,
      linkedUnits: [],
    })
    setBannerPreview(null)
    setSelectedUnits([])
    setApplyToAllUnits(true)
  }

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setBannerPreview(result)
        setFormData({ ...formData, bannerUrl: result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUnitToggle = (unitId: string) => {
    if (selectedUnits.includes(unitId)) {
      setSelectedUnits(selectedUnits.filter((id) => id !== unitId))
    } else {
      setSelectedUnits([...selectedUnits, unitId])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const promotionData: Promotion = {
      ...formData,
      linkedUnits: applyToAllUnits ? [] : selectedUnits,
      id: editingPromotion?.id || "",
      createdAt: editingPromotion?.createdAt || new Date().toISOString(),
      usedCount: editingPromotion?.usedCount || 0,
    }

    onSave(promotionData)
    onClose()
    resetForm()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{editingPromotion ? "Editar Promoção" : "Nova Promoção"}</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Banner Upload */}
            <div>
              <Label className="text-[#3E2415] font-semibold mb-2">Banner da Promoção *</Label>
              <div className="mt-2">
                {bannerPreview ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
                    <img src={bannerPreview || "/placeholder.svg"} alt="Preview" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setBannerPreview(null)
                        setFormData({ ...formData, bannerUrl: "" })
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-lg p-2 hover:bg-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#F58220] hover:bg-orange-50 transition-all">
                    <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-1">Clique para fazer upload do banner</p>
                    <p className="text-xs text-gray-400">JPG, PNG até 5MB</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                  </label>
                )}
              </div>
            </div>

            {/* Title and Description */}
            <div className="grid md:grid-cols-1 gap-4">
              <div>
                <Label htmlFor="title" className="text-[#3E2415] font-semibold">
                  Título da Promoção *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Happy Hour Especial"
                  required
                  className="mt-2 rounded-lg border-gray-300"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-[#3E2415] font-semibold">
                Descrição *
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva os detalhes da promoção..."
                required
                rows={4}
                className="mt-2 rounded-lg border-gray-300"
              />
            </div>

            {/* Validity Dates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validFrom" className="text-[#3E2415] font-semibold">
                  Válido De *
                </Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  required
                  className="mt-2 rounded-lg border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="validUntil" className="text-[#3E2415] font-semibold">
                  Válido Até *
                </Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  required
                  className="mt-2 rounded-lg border-gray-300"
                />
              </div>
            </div>

            {/* QR Code Validity and Cost */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qrValidity" className="text-[#3E2415] font-semibold">
                  Validade do QR Code (minutos) *
                </Label>
                <Input
                  id="qrValidity"
                  type="number"
                  value={formData.qrCodeValidityMinutes}
                  onChange={(e) => setFormData({ ...formData, qrCodeValidityMinutes: Number(e.target.value) })}
                  placeholder="15"
                  min="1"
                  required
                  className="mt-2 rounded-lg border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Tempo que o QR Code fica ativo após ser gerado</p>
              </div>
              <div>
                <Label htmlFor="cost" className="text-[#3E2415] font-semibold">
                  Custo da Promoção (R$) *
                </Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  placeholder="0.00"
                  min="0"
                  required
                  className="mt-2 rounded-lg border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Custo unitário por utilização</p>
              </div>
            </div>

            {/* Stock */}
            <div>
              <Label htmlFor="stock" className="text-[#3E2415] font-semibold">
                Estoque (deixe vazio para ilimitado)
              </Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock || ""}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value ? Number(e.target.value) : null })}
                placeholder="Ilimitado"
                min="1"
                className="mt-2 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">Quantidade máxima de utilizações permitidas</p>
            </div>

            {/* Unit Selection */}
            <div>
              <Label className="text-[#3E2415] font-semibold mb-3 block">Unidades Vinculadas</Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#FFF5E6] to-[#FFE5CC] rounded-lg cursor-pointer hover:shadow-md transition-all">
                  <input
                    type="checkbox"
                    checked={applyToAllUnits}
                    onChange={(e) => {
                      setApplyToAllUnits(e.target.checked)
                      if (e.target.checked) setSelectedUnits([])
                    }}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="font-medium text-[#3E2415]">Aplicar a todas as unidades</span>
                </label>

                {!applyToAllUnits && (
                  <div className="space-y-2 pl-4 border-l-2 border-[#F58220]">
                    {availableUnits.map((unit) => (
                      <label
                        key={unit.id}
                        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-[#3E2415] hover:bg-blue-50 transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUnits.includes(unit.id)}
                          onChange={() => handleUnitToggle(unit.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-[#3E2415]">{unit.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex gap-3 bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-lg border-gray-300 hover:bg-gray-100 bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-lg shadow-lg"
          >
            {editingPromotion ? "Salvar Alterações" : "Criar Promoção"}
          </Button>
        </div>
      </div>
    </div>
  )
}
