"use client"

import type React from "react"

import { useState } from "react"
import { X, Palette, Type, ImageIcon, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface CustomizationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (customization: CustomizationData) => void
  currentCustomization: CustomizationData
}

export interface CustomizationData {
  sidebarBg: string
  sidebarText: string
  fontSize: "small" | "medium" | "large"
  fontFamily: string
  logoUrl: string | null
}

export function CustomizationModal({ isOpen, onClose, onSave, currentCustomization }: CustomizationModalProps) {
  const [sidebarBg, setSidebarBg] = useState(currentCustomization.sidebarBg)
  const [sidebarText, setSidebarText] = useState(currentCustomization.sidebarText)
  const [fontSize, setFontSize] = useState(currentCustomization.fontSize)
  const [fontFamily, setFontFamily] = useState(currentCustomization.fontFamily)
  const [logoPreview, setLogoPreview] = useState<string | null>(currentCustomization.logoUrl)

  if (!isOpen) return null

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = () => {
    onSave({
      sidebarBg,
      sidebarText,
      fontSize,
      fontFamily,
      logoUrl: logoPreview,
    })
    onClose()
  }

  const fontSizeMap = {
    small: { label: "Pequeno", size: "12px" },
    medium: { label: "Médio", size: "14px" },
    large: { label: "Grande", size: "16px" },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[90%] max-w-4xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Personalizar Interface</h2>
                <p className="text-white/80 text-sm">Configure aparência e identidade visual</p>
              </div>
            </div>
            <Button onClick={onClose} variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Cores do Sidebar */}
            <Card className="p-6 border-2 border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-[#F58220]" />
                <h3 className="text-lg font-semibold text-[#3E2415]">Cores do Menu</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="sidebar-bg" className="text-sm">
                    Cor de Fundo
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="sidebar-bg"
                      type="color"
                      value={sidebarBg}
                      onChange={(e) => setSidebarBg(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={sidebarBg}
                      onChange={(e) => setSidebarBg(e.target.value)}
                      className="flex-1"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sidebar-text" className="text-sm">
                    Cor do Texto
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="sidebar-text"
                      type="color"
                      value={sidebarText}
                      onChange={(e) => setSidebarText(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={sidebarText}
                      onChange={(e) => setSidebarText(e.target.value)}
                      className="flex-1"
                      placeholder="#3E2415"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-sm font-medium text-gray-700 mb-3">Temas Predefinidos:</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        setSidebarBg("#FFFFFF")
                        setSidebarText("#3E2415")
                      }}
                      className="group relative w-full h-16 rounded-xl border-2 border-gray-200 hover:border-[#F58220] transition-all overflow-hidden"
                      title="Areia (Padrão)"
                    >
                      <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(135deg, #FFFFFF 50%, #3E2415 50%)" }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                    <button
                      onClick={() => {
                        setSidebarBg("#E8F4F8")
                        setSidebarText("#3E2415")
                      }}
                      className="group relative w-full h-16 rounded-xl border-2 border-gray-200 hover:border-[#3E2415] transition-all overflow-hidden"
                      title="Oceano"
                    >
                      <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(135deg, #E8F4F8 50%, #3E2415 50%)" }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                    <button
                      onClick={() => {
                        setSidebarBg("#FFF5E6")
                        setSidebarText("#F58220")
                      }}
                      className="group relative w-full h-16 rounded-xl border-2 border-gray-200 hover:border-[#FFC800] transition-all overflow-hidden"
                      title="Pôr do Sol"
                    >
                      <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(135deg, #FFF5E6 50%, #F58220 50%)" }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                    <button
                      onClick={() => {
                        setSidebarBg("#FFFFFF")
                        setSidebarText("#333333")
                      }}
                      className="group relative w-full h-16 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition-all overflow-hidden"
                      title="Clássico"
                    >
                      <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(135deg, #FFFFFF 50%, #333333 50%)" }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tipografia */}
            <Card className="p-6 border-2 border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Type className="w-5 h-5 text-[#3E2415]" />
                <h3 className="text-lg font-semibold text-[#3E2415]">Tipografia</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="font-size" className="text-sm">
                    Tamanho da Fonte
                  </Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(Object.keys(fontSizeMap) as Array<keyof typeof fontSizeMap>).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`px-4 py-3 rounded-xl border-2 transition-all ${
                          fontSize === size
                            ? "border-[#F58220] bg-[#F58220]/10 text-[#F58220] font-semibold"
                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        <div className="text-xs font-medium">{fontSizeMap[size].label}</div>
                        <div style={{ fontSize: fontSizeMap[size].size }}>Aa</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="font-family" className="text-sm">
                    Família da Fonte
                  </Label>
                  <select
                    id="font-family"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3E2415] focus:outline-none transition-colors"
                  >
                    <option value="system-ui">System (Padrão)</option>
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Lato">Lato</option>
                  </select>
                </div>

                <div className="pt-2">
                  <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-100">
                    <p
                      className="text-center"
                      style={{
                        fontFamily: fontFamily === "system-ui" ? "system-ui" : `'${fontFamily}', sans-serif`,
                        fontSize: fontSizeMap[fontSize].size,
                      }}
                    >
                      Prévia do Texto
                      <br />
                      <span className="font-bold">Texto em Negrito</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Logo Personalizado */}
            <Card className="p-6 border-2 border-gray-100 shadow-sm md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-[#FFC800]" />
                <h3 className="text-lg font-semibold text-[#3E2415]">Logo Personalizado</h3>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 w-full">
                  <Label htmlFor="logo-upload" className="text-sm">
                    Upload do Logo
                  </Label>
                  <Input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="mt-2" />
                  <p className="text-xs text-gray-500 mt-2">Recomendado: PNG transparente, 200x200px</p>
                </div>

                <div className="flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700 mb-2">Prévia:</p>
                  <div className="w-24 h-24 rounded-2xl border-2 border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                    {logoPreview ? (
                      <img
                        src={logoPreview || "/placeholder.svg"}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <img
                        src="/brand/tribuss-icone-app.png"
                        alt="Tribuss"
                        className="w-16 h-16 rounded-xl object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
          <Button
            onClick={() => {
              setSidebarBg("#FFFFFF")
              setSidebarText("#3E2415")
              setFontSize("medium")
              setFontFamily("system-ui")
              setLogoPreview(null)
            }}
            variant="outline"
            className="rounded-full px-6"
          >
            Resetar Tudo
          </Button>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="rounded-full px-6 bg-transparent">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-full px-8 shadow-lg"
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
