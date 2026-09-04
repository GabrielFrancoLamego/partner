"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Upload, Trash2, MapPin } from "lucide-react"
import type { Unit } from "./units-content"

interface AddUnitModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (unit: Omit<Unit, "id">) => void
  onUpdate?: (unit: Omit<Unit, "id">) => void
  editingUnit?: Unit | null
}

export function AddUnitModal({ isOpen, onClose, onAdd, onUpdate, editingUnit }: AddUnitModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    description: "",
  })
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    if (editingUnit) {
      setFormData({
        name: editingUnit.name,
        address: editingUnit.address,
        phone: editingUnit.phone,
        email: editingUnit.email,
        description: editingUnit.description,
      })
      setPhotos(editingUnit.photos)
    } else {
      setFormData({
        name: "",
        address: "",
        phone: "",
        email: "",
        description: "",
      })
      setPhotos([])
    }
  }, [editingUnit])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newPhotos: string[] = []
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          newPhotos.push(reader.result as string)
          if (newPhotos.length === files.length) {
            setPhotos([...photos, ...newPhotos])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.address || !formData.phone || !formData.email) {
      alert("Por favor, preencha todos os campos obrigatórios")
      return
    }

    const unitData = {
      ...formData,
      photos,
    }

    if (editingUnit && onUpdate) {
      onUpdate(unitData)
    } else {
      onAdd(unitData)
    }

    setFormData({
      name: "",
      address: "",
      phone: "",
      email: "",
      description: "",
    })
    setPhotos([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {editingUnit ? "Editar Unidade" : "Cadastrar Nova Unidade"}
            </h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Nome */}
            <div>
              <Label htmlFor="name" className="text-[#3E2415] font-semibold mb-2 block">
                Nome da Unidade *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Nomad's Jeri - Centro"
                className="border-2 border-gray-200 focus:border-[#F58220] rounded-xl"
              />
            </div>

            {/* Endereço */}
            <div>
              <Label htmlFor="address" className="text-[#3E2415] font-semibold mb-2 block">
                Endereço Completo *
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua Principal, 123 - Jericoacoara, CE"
                className="border-2 border-gray-200 focus:border-[#F58220] rounded-xl"
              />
              <p className="text-xs text-gray-500 mt-1">Este endereço será usado para exibir no mapa</p>
            </div>

            {/* Telefone e Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone" className="text-[#3E2415] font-semibold mb-2 block">
                  Telefone *
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(85) 99999-9999"
                  className="border-2 border-gray-200 focus:border-[#3E2415] rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-[#3E2415] font-semibold mb-2 block">
                  E-mail *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="unidade@nomadsjeri.com"
                  className="border-2 border-gray-200 focus:border-[#3E2415] rounded-xl"
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="description" className="text-[#3E2415] font-semibold mb-2 block">
                Descrição Resumida
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição sobre esta unidade..."
                rows={3}
                className="border-2 border-gray-200 focus:border-[#FFC800] rounded-xl resize-none"
              />
            </div>

            {/* Galeria de Fotos */}
            <div>
              <Label className="text-[#3E2415] font-semibold mb-2 block">Galeria de Fotos</Label>
              <div className="space-y-4">
                {/* Upload Button */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#F58220] transition-colors">
                  <input
                    type="file"
                    id="photos"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="photos"
                    className="cursor-pointer flex flex-col items-center gap-2 text-gray-600 hover:text-[#F58220]"
                  >
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-medium">Clique para adicionar fotos</span>
                    <span className="text-xs text-gray-500">JPG, PNG ou WEBP até 5MB</span>
                  </label>
                </div>

                {/* Photo Preview Grid */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group aspect-square rounded-xl overflow-hidden">
                        <img
                          src={photo || "/placeholder.svg"}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-2 border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl py-6 bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl py-6 shadow-lg"
          >
            {editingUnit ? "Salvar Alterações" : "Cadastrar Unidade"}
          </Button>
        </div>
      </div>
    </div>
  )
}
