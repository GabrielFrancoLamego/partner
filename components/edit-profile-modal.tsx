"use client"

import type React from "react"

import { X, Upload, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useState } from "react"

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profileData: {
    businessName: string
    username: string
    description: string
    logo: string
    banner: string
  }
  onSave: (data: any) => void
}

export function EditProfileModal({ isOpen, onClose, profileData, onSave }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    businessName: profileData.businessName,
    username: profileData.username,
    email: "contato@nomadsjeri.com",
    phone: "+55 88 99999-9999",
    description: profileData.description,
    website: "www.nomadsjeri.com",
    address: "Jericoacoara, Ceará - Brasil",
    logo: profileData.logo,
    banner: profileData.banner,
  })

  useState(() => {
    setFormData({
      businessName: profileData.businessName,
      username: profileData.username,
      email: "contato@nomadsjeri.com",
      phone: "+55 88 99999-9999",
      description: profileData.description,
      website: "www.nomadsjeri.com",
      address: "Jericoacoara, Ceará - Brasil",
      logo: profileData.logo,
      banner: profileData.banner,
    })
  })

  if (!isOpen) return null

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "logo" | "banner") => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({ ...formData, [field]: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <>
      {/* Backdrop with blur effect */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl pointer-events-auto animate-in zoom-in-95 duration-200"
          style={{ maxHeight: "85vh" }}
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] p-6 rounded-t-3xl">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-2xl font-bold text-white">Editar Perfil</h2>
            <p className="text-white/90 text-sm mt-1">Atualize suas informações de parceiro</p>
          </div>

          {/* Form Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(85vh - 180px)" }}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Profile Images Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-5 border-b border-gray-200">
                <div>
                  <Label className="text-sm font-semibold text-[#3E2415] mb-2 block">Banner de Fundo</Label>
                  <div className="relative h-32 bg-gradient-to-br from-[#F58220]/20 to-[#FFC800]/20 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#F58220] transition-colors cursor-pointer group overflow-hidden">
                    {formData.banner && (
                      <img
                        src={formData.banner || "/placeholder.svg"}
                        alt="Banner preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="banner-upload"
                      onChange={(e) => handleImageUpload(e, "banner")}
                    />
                    <label
                      htmlFor="banner-upload"
                      className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-black/0 hover:bg-black/10 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                      <span className="text-xs text-white drop-shadow-lg mt-2">Clique para enviar</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-[#3E2415] mb-2 block">Logo do Perfil</Label>
                  <div className="relative h-32 flex items-center justify-center">
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-[#3E2415]/20 to-[#F58220]/20 border-2 border-dashed border-gray-300 hover:border-[#3E2415] transition-colors cursor-pointer group overflow-hidden">
                      {formData.logo && (
                        <img
                          src={formData.logo || "/placeholder.svg"}
                          alt="Logo preview"
                          className="absolute inset-0 w-full h-full object-cover rounded-full"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="logo-upload"
                        onChange={(e) => handleImageUpload(e, "logo")}
                      />
                      <label
                        htmlFor="logo-upload"
                        className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-black/0 hover:bg-black/10 transition-colors rounded-full"
                      >
                        <Camera className="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-white drop-shadow-lg mt-2">Enviar</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName" className="text-sm font-semibold text-[#3E2415]">
                    Nome do Negócio
                  </Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-sm font-semibold text-[#3E2415]">
                    Nome de Usuário
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-sm font-semibold text-[#3E2415]">
                  Descrição
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl resize-none"
                  placeholder="Descreva seu negócio..."
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-semibold text-[#3E2415]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-semibold text-[#3E2415]">
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl"
                  />
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website" className="text-sm font-semibold text-[#3E2415]">
                    Website
                  </Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="text-sm font-semibold text-[#3E2415]">
                    Endereço
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1.5 border-gray-300 focus:border-[#3E2415] focus:ring-[#3E2415] rounded-xl"
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-3xl border-t border-gray-200 flex gap-3 justify-end">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="rounded-full px-6 border-gray-300 hover:bg-gray-100 bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              className="rounded-full px-6 bg-gradient-to-r from-[#F2680C] to-[#3E2415] hover:from-[#F58220]/90 hover:to-[#3E2415]/90 text-white shadow-lg"
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
