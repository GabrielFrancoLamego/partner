"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, MapPin, Phone, Mail, Edit, Trash2 } from "lucide-react"
import { AddUnitModal } from "./add-unit-modal"

export interface Unit {
  id: string
  name: string
  address: string
  phone: string
  email: string
  description: string
  photos: string[]
}

export function UnitsContent() {
  const [units, setUnits] = useState<Unit[]>([
    {
      id: "1",
      name: "Nomad's Jeri - Unidade Principal",
      address: "Rua Principal, 123 - Jericoacoara, CE, 62598-000",
      phone: "+55 (88) 98765-4321",
      email: "contato@nomadsjeri.com.br",
      description:
        "Restaurante e Bar em Jericoacoara. Pizzaria, Lounge narguile sunset e Bar com música ao vivo. Tudo com um toque especial. ✨",
      photos: ["/images/nomads-unit-sample.jpg"],
    },
  ])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)

  const handleAddUnit = (newUnit: Omit<Unit, "id">) => {
    const unitWithId = {
      ...newUnit,
      id: Date.now().toString(),
    }
    setUnits([...units, unitWithId])
  }

  const handleUpdateUnit = (updatedUnit: Omit<Unit, "id">) => {
    if (editingUnit) {
      setUnits(units.map((unit) => (unit.id === editingUnit.id ? { ...updatedUnit, id: editingUnit.id } : unit)))
      setEditingUnit(null)
    }
  }

  const handleDeleteUnit = (id: string) => {
    setUnits(units.filter((unit) => unit.id !== id))
  }

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3E2415]">Unidades</h2>
          <p className="text-sm text-gray-600 mt-1">Gerencie suas unidades parceiras</p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar Unidade
        </Button>
      </div>

      {/* Units Grid */}
      {units.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-md border border-gray-100 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] flex items-center justify-center">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-[#3E2415] mb-2">Nenhuma unidade cadastrada</h3>
          <p className="text-sm text-gray-600 mb-6">
            Comece cadastrando sua primeira unidade para gerenciar seus parceiros.
          </p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Primeira Unidade
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Unit Photos */}
              <div className="relative h-48 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800]">
                {unit.photos.length > 0 ? (
                  <img
                    src={unit.photos[0] || "/placeholder.svg"}
                    alt={unit.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-12 h-12 text-white/50" />
                  </div>
                )}
              </div>

              {/* Unit Info */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-[#3E2415] mb-2">{unit.name}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{unit.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-[#F58220] mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{unit.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-[#3E2415] flex-shrink-0" />
                    <span className="text-gray-700">{unit.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-[#FFC800] flex-shrink-0" />
                    <span className="text-gray-700">{unit.email}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditUnit(unit)}
                    className="flex-1 border-[#3E2415] text-[#3E2415] hover:bg-[#3E2415] hover:text-white bg-transparent"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUnit(unit.id)}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddUnitModal
        isOpen={isAddModalOpen || editingUnit !== null}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingUnit(null)
        }}
        onAdd={handleAddUnit}
        onUpdate={handleUpdateUnit}
        editingUnit={editingUnit}
      />
    </div>
  )
}
