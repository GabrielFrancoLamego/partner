"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, Award, Info, FileText, Upload } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import type { Program, ProgramLevel } from "./programs-content"

type AddProgramModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (program: Program) => void
  editingProgram: Program | null
}

type ExtendedProgram = Program & {
  contract?: string
  materials?: { id: string; name: string; url: string; type: string }[]
}

export function AddProgramModal({ isOpen, onClose, onSave, editingProgram }: AddProgramModalProps) {
  const [formData, setFormData] = useState<Omit<ExtendedProgram, "id" | "createdAt">>({
    name: "",
    description: "",
    commissionType: "variable",
    commissionValue: 0,
    isPercentage: true,
    hasLevels: true,
    autoUpgrade: true,
    levels: [],
    contract: "",
    materials: [],
  })

  const [newLevel, setNewLevel] = useState<Omit<ProgramLevel, "id">>({
    name: "",
    commissionPercentage: 0,
    bonus: "",
    criteria: {
      referralsCount: 0,
      periodMonths: 3,
    },
  })

  useEffect(() => {
    if (editingProgram) {
      setFormData(editingProgram as ExtendedProgram)
    } else {
      setFormData({
        name: "",
        description: "",
        commissionType: "variable",
        commissionValue: 0,
        isPercentage: true,
        hasLevels: true,
        autoUpgrade: true,
        levels: [],
        contract: "",
        materials: [],
      })
    }
  }, [editingProgram, isOpen])

  const handleAddLevel = () => {
    if (!newLevel.name || newLevel.commissionPercentage <= 0 || newLevel.criteria.referralsCount <= 0) {
      alert("Preencha todos os campos do nível antes de adicionar")
      return
    }

    setFormData({
      ...formData,
      levels: [...formData.levels, { ...newLevel, id: Date.now().toString() }],
    })

    setNewLevel({
      name: "",
      commissionPercentage: 0,
      bonus: "",
      criteria: {
        referralsCount: 0,
        periodMonths: 3,
      },
    })
  }

  const handleRemoveLevel = (id: string) => {
    setFormData({
      ...formData,
      levels: formData.levels.filter((level) => level.id !== id),
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newMaterials = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
    }))

    setFormData({
      ...formData,
      materials: [...(formData.materials || []), ...newMaterials],
    })
  }

  const handleRemoveMaterial = (id: string) => {
    setFormData({
      ...formData,
      materials: (formData.materials || []).filter((material) => material.id !== id),
    })
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.description) {
      alert("Preencha o nome e descrição do programa")
      return
    }

    if (formData.commissionType === "fixed" && formData.commissionValue <= 0) {
      alert("Defina o valor da comissão fixa")
      return
    }

    if (formData.hasLevels && formData.levels.length === 0) {
      alert("Adicione pelo menos um nível ao programa")
      return
    }

    if (editingProgram) {
      onSave({ ...formData, id: editingProgram.id, createdAt: editingProgram.createdAt })
    } else {
      onSave(formData as Program)
    }

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF7A28] via-[#FFBE3B] to-[#0078B7] p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{editingProgram ? "Editar Programa" : "Criar Novo Programa"}</h2>
              <p className="text-sm text-white/90 mt-1">Configure regras e níveis de comissão</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#0A2E4D] flex items-center gap-2">
                <Info className="w-5 h-5 text-[#FF7A28]" />
                Informações Básicas
              </h3>

              <div>
                <Label htmlFor="program-name">Nome do Programa *</Label>
                <Input
                  id="program-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Programa Nomad's Jeri"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label htmlFor="program-description">Descrição *</Label>
                <Textarea
                  id="program-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva seu programa de parceria..."
                  className="rounded-xl min-h-[80px]"
                />
              </div>
            </div>

            {/* Commission Type */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#0A2E4D]">Tipo de Comissão</h3>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, commissionType: "fixed", hasLevels: false })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.commissionType === "fixed"
                      ? "border-[#FF7A28] bg-[#FFF5E6]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-[#0A2E4D]">Fixa</p>
                  <p className="text-xs text-gray-600 mt-1">Mesma comissão para todos</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, commissionType: "variable", hasLevels: true })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.commissionType === "variable"
                      ? "border-[#0078B7] bg-[#E8F4F8]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-[#0A2E4D]">Variável por Nível</p>
                  <p className="text-xs text-gray-600 mt-1">Comissão aumenta com crescimento</p>
                </button>
              </div>

              {formData.commissionType === "fixed" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="commission-value">Valor da Comissão *</Label>
                    <Input
                      id="commission-value"
                      type="number"
                      value={formData.commissionValue}
                      onChange={(e) =>
                        setFormData({ ...formData, commissionValue: Number.parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0"
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="commission-type-select">Tipo *</Label>
                    <select
                      id="commission-type-select"
                      value={formData.isPercentage ? "percentage" : "fixed"}
                      onChange={(e) => setFormData({ ...formData, isPercentage: e.target.value === "percentage" })}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    >
                      <option value="percentage">Percentual (%)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Levels */}
            {formData.hasLevels && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#0A2E4D] flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#FFBE3B]" />
                    Níveis de Parceria
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-upgrade" className="text-sm">
                      Auto Upgrade
                    </Label>
                    <input
                      id="auto-upgrade"
                      type="checkbox"
                      checked={formData.autoUpgrade}
                      onChange={(e) => setFormData({ ...formData, autoUpgrade: e.target.checked })}
                      className="w-4 h-4 text-[#0078B7] rounded"
                    />
                  </div>
                </div>

                {/* Existing Levels */}
                {formData.levels.length > 0 && (
                  <div className="space-y-3">
                    {formData.levels.map((level, index) => (
                      <div
                        key={level.id}
                        className="bg-gradient-to-r from-[#FFF5E6] to-[#E8F4F8] rounded-xl p-4 flex items-start justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-[#0A2E4D]">{index + 1}.</span>
                            <h4 className="font-bold text-[#0A2E4D]">{level.name}</h4>
                            <span className="px-2 py-1 bg-[#FF7A28] text-white rounded-full text-xs font-semibold">
                              {level.commissionPercentage}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">Bônus: {level.bonus}</p>
                          <p className="text-xs text-gray-500">
                            Critério: {level.criteria.referralsCount} indicações em {level.criteria.periodMonths} meses
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveLevel(level.id)}
                          className="rounded-lg border-red-400 text-red-500 hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Level */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold text-[#0A2E4D]">Adicionar Novo Nível</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="level-name">Nome do Nível</Label>
                      <Input
                        id="level-name"
                        value={newLevel.name}
                        onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
                        placeholder="Ex: Prata, Ouro, Diamante"
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="level-commission">Comissão (%)</Label>
                      <Input
                        id="level-commission"
                        type="number"
                        value={newLevel.commissionPercentage || ""}
                        onChange={(e) =>
                          setNewLevel({ ...newLevel, commissionPercentage: Number.parseFloat(e.target.value) || 0 })
                        }
                        placeholder="0"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="level-bonus">Bônus de Upgrade</Label>
                    <Input
                      id="level-bonus"
                      value={newLevel.bonus}
                      onChange={(e) => setNewLevel({ ...newLevel, bonus: e.target.value })}
                      placeholder="Ex: R$ 50 em consumo na unidade"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="level-referrals">Indicações Necessárias</Label>
                      <Input
                        id="level-referrals"
                        type="number"
                        value={newLevel.criteria.referralsCount || ""}
                        onChange={(e) =>
                          setNewLevel({
                            ...newLevel,
                            criteria: { ...newLevel.criteria, referralsCount: Number.parseInt(e.target.value) || 0 },
                          })
                        }
                        placeholder="0"
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="level-period">Período (meses)</Label>
                      <Input
                        id="level-period"
                        type="number"
                        value={newLevel.criteria.periodMonths || ""}
                        onChange={(e) =>
                          setNewLevel({
                            ...newLevel,
                            criteria: { ...newLevel.criteria, periodMonths: Number.parseInt(e.target.value) || 0 },
                          })
                        }
                        placeholder="3"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleAddLevel}
                    className="w-full bg-gradient-to-r from-[#0078B7] to-[#00A8E8] hover:from-[#006BA7] hover:to-[#0098D8] text-white rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Nível
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#0A2E4D] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0078B7]" />
                Contrato do Programa
              </h3>
              <div>
                <Label htmlFor="program-contract">Termos e Condições</Label>
                <Textarea
                  id="program-contract"
                  value={formData.contract}
                  onChange={(e) => setFormData({ ...formData, contract: e.target.value })}
                  placeholder="Digite aqui os termos e condições do programa de parceria, regras, direitos e deveres..."
                  className="rounded-xl min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este contrato será apresentado aos parceiros quando se cadastrarem no programa
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#0A2E4D] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#FFBE3B]" />
                Material de Apoio
              </h3>
              <p className="text-sm text-gray-600">
                Adicione materiais para ajudar os parceiros a prosperar no programa (PDFs, imagens, vídeos, etc.)
              </p>

              {/* Uploaded Materials List */}
              {formData.materials && formData.materials.length > 0 && (
                <div className="space-y-2">
                  {formData.materials.map((material) => (
                    <div
                      key={material.id}
                      className="bg-gradient-to-r from-[#FFF5E6] to-white rounded-xl p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#FF7A28] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-[#0A2E4D] text-sm">{material.name}</p>
                          <p className="text-xs text-gray-500">{material.type}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMaterial(material.id)}
                        className="rounded-lg border-red-400 text-red-500 hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#FF7A28] transition-colors">
                <label htmlFor="materials-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#FFF5E6] flex items-center justify-center">
                      <Upload className="w-6 h-6 text-[#FF7A28]" />
                    </div>
                    <p className="font-medium text-[#0A2E4D]">Clique para fazer upload</p>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG, MP4, etc.</p>
                  </div>
                  <input
                    id="materials-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.mp4,.doc,.docx,.xls,.xlsx"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex gap-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 rounded-xl border-gray-300 hover:bg-gray-100 bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl shadow-lg"
          >
            {editingProgram ? "Salvar Alterações" : "Criar Programa"}
          </Button>
        </div>
      </div>
    </div>
  )
}
