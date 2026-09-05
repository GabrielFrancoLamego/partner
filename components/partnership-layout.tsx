"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { toMenuBucket, type AuthUser } from "@/lib/role-bucket"
import { isCompanyStaff } from "@/lib/permissions"
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
import { WelcomeContent } from "./welcome-content"

export function PartnershipLayout() {
  const router = useRouter()
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [activeMenu, setActiveMenu] = useState("Dashboard")
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false)
  const [customization, setCustomization] = useState<CustomizationData>({
    sidebarBg: "#FFFFFF",
    sidebarText: "#3E2415",
    fontSize: "medium",
    fontFamily: "system-ui",
    logoUrl: null,
  })

  const isLoggedIn = currentUser !== null
  const userType = currentUser ? toMenuBucket(currentUser.role) : null

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((user: AuthUser | null) => {
        if (user?.role === "ADMIN") {
          router.replace("/admin")
          return
        }
        if (user && isCompanyStaff(user.role)) {
          router.replace("/company")
          return
        }
        if (user?.role === "PARTNER") {
          router.replace("/partner")
          return
        }
        setCurrentUser(user)
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setIsCheckingSession(false))
  }, [router])

  const handleCustomizationSave = (newCustomization: CustomizationData) => {
    setCustomization(newCustomization)
  }

  const handleLogin = (user: AuthUser) => {
    if (user.role === "ADMIN") {
      router.push("/admin")
      return
    }
    if (isCompanyStaff(user.role)) {
      router.push("/company")
      return
    }
    if (user.role === "PARTNER") {
      router.push("/partner")
      return
    }
    setCurrentUser(user)
    setActiveMenu("Dashboard")
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setActiveMenu("Dashboard")
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
  }

  if (isCheckingSession) {
    return <div className="min-h-screen bg-gradient-to-br from-[#E8F4F8] to-[#FFF5E6]" />
  }

  if (!isLoggedIn) {
    return <WelcomeContent onLogin={handleLogin} />
  }

  const renderContent = () => {
    switch (activeMenu) {
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
            <h3 className="text-xl font-bold text-[#3E2415] mb-2">Suporte</h3>
            <p className="text-gray-600">Entre em contato com nossa equipe de suporte.</p>
          </div>
        )
      default:
        return (
          <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 text-center">
            <h3 className="text-xl font-bold text-[#3E2415] mb-2">{activeMenu}</h3>
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
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-gray-100 bg-white/90 px-4 py-2 backdrop-blur lg:px-8">
          <p className="min-w-0 truncate text-xs text-gray-500">
            Logado como <span className="font-semibold text-[#3E2415]">{currentUser.name}</span>
          </p>
          <button
            onClick={handleLogout}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#3E2415] transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
        <PartnershipHeader />
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
