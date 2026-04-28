"use client"

import { Camera, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { useState } from "react"

export function PartnershipHeader() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [profileData, setProfileData] = useState({
    businessName: "Nomad's Jeri",
    username: "@nomadsjeri_oficial",
    description: "Restaurante em Jericoacoara 🍽️\nPizzaria em Jeri 🍕\nLounge narguile sunset em Jeri 🌅",
    logo: "/images/470487981-1134320291672387-5086673552666144386-n.jpg",
    banner: "/images/belos-cactos-com-paisagem-desertica-e-por-sol.jpg",
  })

  const handleSaveProfile = (data: typeof profileData) => {
    setProfileData(data)
    setIsEditModalOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative h-64 md:h-72 lg:h-80 overflow-hidden rounded-b-3xl">
        <img src={profileData.banner || "/placeholder.svg"} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />

        
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="relative -mt-12 md:-mt-16 bg-white rounded-3xl shadow-lg p-3 md:p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative -mt-16 md:-mt-20">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white p-1 shadow-xl">
                <img
                  src={profileData.logo || "/placeholder.svg"}
                  alt="Nomad's Jeri Logo"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div>
                  <h1 className="text-base md:text-lg font-bold text-[#0A2E4D] whitespace-nowrap">
                    {profileData.businessName}
                  </h1>
                  <p className="text-gray-600 text-xs">{profileData.username}</p>
                  <p className="text-gray-700 mt-1 text-xs whitespace-pre-line">{profileData.description}</p>
                </div>

                <Button
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-[#0078B7] hover:bg-[#006399] text-white rounded-full px-4 py-1 text-xs h-8"
                >
                  Editar Perfil
                </Button>
              </div>

              <div className="flex gap-4 md:gap-6 mt-3 text-xs">
                <div>
                  <span className="font-bold text-[#0A2E4D]">8.367</span>
                  <span className="text-gray-600 ml-1">Seguidores</span>
                </div>
                <div>
                  <span className="font-bold text-[#0A2E4D]">245</span>
                  <span className="text-gray-600 ml-1">Parceiros</span>
                </div>
                <div>
                  <span className="font-bold text-[#0A2E4D]">1.2M</span>
                  <span className="text-gray-600 ml-1">Comissões</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profileData={profileData}
        onSave={handleSaveProfile}
      />
    </div>
  )
}
