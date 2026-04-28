"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, TrendingUp, Award, Users } from "lucide-react"
import { Button } from "./ui/button"
import { AddProgramModal } from "./add-program-modal"

export type ProgramLevel = {
  id: string
  name: string
  commissionPercentage: number
  bonus: string
  criteria: {
    referralsCount: number
    periodMonths: number
  }
}

export type Program = {
  id: string
  name: string
  description: string
  commissionType: "fixed" | "variable"
  commissionValue: number
  isPercentage: boolean
  hasLevels: boolean
  levels: ProgramLevel[]
  autoUpgrade: boolean
  createdAt: string
  contract?: string
  materials?: { id: string; name: string; url: string; type: string }[]
}

export function ProgramsContent() {
  const [programs, setPrograms] = useState<Program[]>([
    {
      id: "1",
      name: "Programa Nomad's Jeri",
      description: "Programa de parceria com três níveis de crescimento para restaurantes e bares",
      commissionType: "variable",
      commissionValue: 0,
      isPercentage: true,
      hasLevels: true,
      autoUpgrade: true,
      levels: [
        {
          id: "1",
          name: "Prata",
          commissionPercentage: 5,
          bonus: "R$ 50 em consumo na unidade",
          criteria: {
            referralsCount: 10,
            periodMonths: 3,
          },
        },
        {
          id: "2",
          name: "Ouro",
          commissionPercentage: 8,
          bonus: "R$ 100 em consumo na unidade",
          criteria: {
            referralsCount: 30,
            periodMonths: 3,
          },
        },
        {
          id: "3",
          name: "Diamante",
          commissionPercentage: 12,
          bonus: "R$ 200 em consumo + Jantar VIP",
          criteria: {
            referralsCount: 60,
            periodMonths: 3,
          },
        },
      ],
      createdAt: "2024-01-15",
    },
  ])

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)

  const handleAddProgram = (program: Program) => {
    setPrograms([...programs, { ...program, id: Date.now().toString(), createdAt: new Date().toISOString() }])
  }

  const handleEditProgram = (program: Program) => {
    setPrograms(programs.map((p) => (p.id === program.id ? program : p)))
  }

  const handleDeleteProgram = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este programa?")) {
      setPrograms(programs.filter((p) => p.id !== id))
    }
  }

  const openEditModal = (program: Program) => {
    setEditingProgram(program)
    setIsAddModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#0A2E4D]">Programas de Parceria</h2>
          <p className="text-sm text-gray-600 mt-1">Gerencie seus programas de comissão e níveis de parceiros</p>
        </div>
        <Button
          onClick={() => {
            setEditingProgram(null)
            setIsAddModalOpen(true)
          }}
          className="bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl px-6 shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Programa
        </Button>
      </div>

      {/* Programs List */}
      <div className="grid gap-6">
        {programs.map((program) => (
          <div
            key={program.id}
            className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6 text-[#FF7A28]" />
                    <h3 className="text-xl font-bold text-[#0A2E4D]">{program.name}</h3>
                    {program.autoUpgrade && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Auto Upgrade
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{program.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(program)}
                    className="rounded-lg border-[#0078B7] text-[#0078B7] hover:bg-[#0078B7] hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProgram(program.id)}
                    className="rounded-lg border-red-400 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Program Details */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gradient-to-br from-[#FFF5E6] to-[#FFE5CC] rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">Tipo de Comissão</p>
                  <p className="text-sm font-semibold text-[#0A2E4D]">
                    {program.commissionType === "fixed" ? "Fixa" : "Variável por Nível"}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-[#E8F4F8] to-[#D0E7F0] rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">Níveis</p>
                  <p className="text-sm font-semibold text-[#0A2E4D]">
                    {program.hasLevels ? `${program.levels.length} níveis` : "Nível único"}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-[#FFE5E5] to-[#FFD5D5] rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">Criado em</p>
                  <p className="text-sm font-semibold text-[#0A2E4D]">
                    {new Date(program.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              {/* Levels */}
              {program.hasLevels && program.levels.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-[#FFBE3B]" />
                    <h4 className="font-semibold text-[#0A2E4D]">Níveis de Parceria</h4>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {program.levels.map((level, index) => (
                      <div
                        key={level.id}
                        className="border-2 border-gray-200 rounded-xl p-4 hover:border-[#FF7A28] transition-colors relative overflow-hidden"
                      >
                        <div
                          className={`absolute top-0 right-0 w-20 h-20 opacity-10 ${
                            index === 0 ? "bg-gray-400" : index === 1 ? "bg-yellow-400" : "bg-blue-400"
                          }`}
                          style={{
                            clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                          }}
                        />
                        <div className="relative z-10">
                          <h5 className="font-bold text-[#0A2E4D] mb-2">{level.name}</h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Comissão:</span>
                              <span className="font-semibold text-[#FF7A28]">{level.commissionPercentage}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Bônus:</span>
                              <span className="font-semibold text-[#0078B7] text-right">{level.bonus}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-gray-600 mb-1">Critério de Upgrade:</p>
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-gray-500" />
                                <span className="font-medium text-[#0A2E4D]">
                                  {level.criteria.referralsCount} indicações em {level.criteria.periodMonths} meses
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract and Materials */}
              {program.contract && (
                <div className="bg-gradient-to-br from-[#F9E79F] to-[#F3D250] rounded-xl p-4">
                  <p className="text-xs text-gray-600 mb-1">Contrato</p>
                  <p className="text-sm font-semibold text-[#0A2E4D]">{program.contract}</p>
                </div>
              )}

              {program.materials && program.materials.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-[#FFBE3B]" />
                    <h4 className="font-semibold text-[#0A2E4D]">Materiais</h4>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    {program.materials.map((material) => (
                      <div
                        key={material.id}
                        className="border-2 border-gray-200 rounded-xl p-4 hover:border-[#FF7A28] transition-colors relative overflow-hidden"
                      >
                        <div className="relative z-10">
                          <h5 className="font-bold text-[#0A2E4D] mb-2">{material.name}</h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Tipo:</span>
                              <span className="font-semibold text-[#FF7A28]">{material.type}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">URL:</span>
                              <span className="font-semibold text-[#0078B7] text-right">{material.url}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {programs.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-md border border-gray-100">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#0A2E4D] mb-2">Nenhum programa cadastrado</h3>
          <p className="text-gray-600 mb-6">Crie seu primeiro programa de parceria para começar</p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Programa
          </Button>
        </div>
      )}

      <AddProgramModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingProgram(null)
        }}
        onSave={editingProgram ? handleEditProgram : handleAddProgram}
        editingProgram={editingProgram}
      />
    </div>
  )
}
