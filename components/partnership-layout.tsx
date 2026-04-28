"use client"

import { useState } from "react"
import { DesktopSidebar } from "./desktop-sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { PartnershipHeader } from "./partnership-header"
import { DashboardContent } from "./dashboard-content"
import { CustomizationModal, type CustomizationData } from "./customization-modal"
import { UnitsContent } from "./units-content"
import { ProgramsContent } from "./programs-content"
import { PromotionsContent } from "./promotions-content"
import { IndicationsContent } from "./indications-content"
import { QRScannerContent } from "./qr-scanner-content"
import { CommissionsContent } from "./commissions-content"
import { PartnersContent } from "./partners-content"
import { UsersContent } from "./users-content"
import { ReportsContent } from "./reports-content"
import { LoginContent } from "./login-content"
import { WelcomeContent } from "./welcome-content"

export function PartnershipLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userType, setUserType] = useState<"admin" | "partner" | null>(null)
  const [activeMenu, setActiveMenu] = useState("Dashboard")
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false)
  const [customization, setCustomization] = useState<CustomizationData>({
    sidebarBg: "#F4E9D8",
    sidebarText: "#0A2E4D",
    fontSize: "medium",
    fontFamily: "system-ui",
    logoUrl: null,
  })

  const handleCustomizationSave = (newCustomization: CustomizationData) => {
    setCustomization(newCustomization)
  }

  const handleLogin = (type: "admin" | "partner") => {
    setIsLoggedIn(true)
    setUserType(type)
    setActiveMenu("Dashboard")
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserType(null)
    setActiveMenu("Login")
  }

  const renderContent = () => {
    if (!isLoggedIn && activeMenu !== "Login") {
      return <WelcomeContent />
    }

    switch (activeMenu) {
      case "Login":
        return <LoginContent onLogin={handleLogin} />
      case "Dashboard":
        return <DashboardContent />
      case "Unidades":
        return <UnitsContent />
      case "Programas":
        return <ProgramsContent />
      case "Promoções":
        return <PromotionsContent />
      case "Indicações":
        return <IndicationsContent />
      case "Scanner QR":
        return <QRScannerContent />
      case "Comissões":
        return <CommissionsContent />
      case "Parceiros":
        return <PartnersContent />
      case "Usuários":
        return <UsersContent />
      case "Relatórios":
        return <ReportsContent />
      case "Suporte":
        return (
          <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 text-center">
            <h3 className="text-xl font-bold text-[#0A2E4D] mb-2">Suporte</h3>
            <p className="text-gray-600">Entre em contato com nossa equipe de suporte.</p>
          </div>
        )
      default:
        return (
          <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 text-center">
            <h3 className="text-xl font-bold text-[#0A2E4D] mb-2">{activeMenu}</h3>
            <p className="text-gray-600">Conteúdo de {activeMenu} será implementado em breve.</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E8F4F8] to-[#FFF5E6]">
      {/* Desktop Sidebar */}
      <DesktopSidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        onCustomizeClick={() => setIsCustomizationOpen(true)}
        sidebarBg={customization.sidebarBg}
        sidebarText={customization.sidebarText}
        logoUrl={customization.logoUrl}
        isLoggedIn={isLoggedIn}
        userType={userType}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="lg:ml-[260px] pb-20 lg:pb-0">
        {isLoggedIn && <PartnershipHeader />}
        <main className="p-4 md:p-6 lg:p-8">{renderContent()}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        isLoggedIn={isLoggedIn}
        userType={userType}
        onLogout={handleLogout}
      />

      <CustomizationModal
        isOpen={isCustomizationOpen}
        onClose={() => setIsCustomizationOpen(false)}
        onSave={handleCustomizationSave}
        currentCustomization={customization}
      />
    </div>
  )
}
