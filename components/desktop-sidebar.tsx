"use client"

import {
  LayoutDashboard,
  Building2,
  Boxes,
  Tag,
  Users,
  QrCode,
  Wallet,
  UsersRound,
  Paintbrush,
  FileText,
  HeadphonesIcon,
  LogOut,
  LogIn,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DesktopSidebarProps {
  activeMenu: string
  setActiveMenu: (menu: string) => void
  onCustomizeClick: () => void
  sidebarBg?: string
  sidebarText?: string
  logoUrl?: string | null
  isLoggedIn: boolean
  userType: "admin" | "partner" | null
  onLogout: () => void
}

const menuItems = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "partner"] },
  { id: "Unidades", label: "Unidades", icon: Building2, roles: ["admin", "partner"] },
  { id: "Programas", label: "Programas", icon: Boxes, roles: ["admin", "partner"] },
  { id: "Promoções", label: "Promoções", icon: Tag, roles: ["admin", "partner"] },
  { id: "Indicações", label: "Indicações", icon: Users, roles: ["admin", "partner"] },
  { id: "Scanner QR", label: "Scanner QR", icon: QrCode, roles: ["admin", "partner"] },
  { id: "Comissões", label: "Comissões", icon: Wallet, roles: ["admin", "partner"] },
  { id: "Parceiros", label: "Parceiros", icon: UsersRound, roles: ["admin", "partner"] },
  { id: "Usuários", label: "Usuários", icon: Users, roles: ["admin"] },
  { id: "Relatórios", label: "Relatórios", icon: FileText, roles: ["admin", "partner"] },
  { id: "Suporte", label: "Suporte", icon: HeadphonesIcon, roles: ["partner"] },
]

export function DesktopSidebar({
  activeMenu,
  setActiveMenu,
  onCustomizeClick,
  sidebarBg = "#F4E9D8",
  sidebarText = "#0A2E4D",
  logoUrl = null,
  isLoggedIn,
  userType,
  onLogout,
}: DesktopSidebarProps) {
  const filteredMenuItems = isLoggedIn ? menuItems.filter((item) => item.roles.includes(userType || "")) : []

  const handleLogoutClick = () => {
    onLogout()
  }

  return (
    <aside
      className="hidden lg:flex fixed left-0 top-0 h-screen w-[260px] flex-col border-r border-[#E5D5C0] shadow-sm"
      style={{ backgroundColor: sidebarBg }}
    >
      <div className="p-4 border-b border-[#E5D5C0]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl || "/placeholder.svg"} alt="Logo" className="w-10 h-10 rounded-xl object-contain" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF7A28] via-[#FFBE3B] to-[#0078B7] rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
                <span className="text-white font-bold text-xl relative z-10" style={{ fontFamily: "Georgia, serif" }}>
                  P
                </span>
              </div>
            )}
            <div>
              <h2 className="text-base font-bold" style={{ color: sidebarText }}>
                Partnership
              </h2>
              <p className="text-xs" style={{ color: sidebarText, opacity: 0.6 }}>
                Plataforma
              </p>
            </div>
          </div>

          {isLoggedIn && (
            <button
              onClick={onCustomizeClick}
              className="p-2 hover:bg-[#E5D5C0] rounded-lg transition-colors"
              title="Personalizar"
            >
              <Paintbrush className="w-4 h-4" style={{ color: sidebarText }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {isLoggedIn ? (
            filteredMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeMenu === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                    isActive
                      ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white shadow-md"
                      : "hover:bg-[#E5D5C0]",
                  )}
                  style={!isActive ? { color: sidebarText } : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              )
            })
          ) : (
            <button
              onClick={() => setActiveMenu("Login")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                activeMenu === "Login"
                  ? "bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] text-white shadow-md"
                  : "hover:bg-[#E5D5C0]",
              )}
              style={activeMenu !== "Login" ? { color: sidebarText } : undefined}
            >
              <LogIn className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">Login</span>
            </button>
          )}
        </div>
      </div>

      {isLoggedIn && (
        <div className="border-t border-[#E5D5C0] p-3 space-y-1">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left hover:bg-[#E5D5C0]"
            style={{ color: sidebarText }}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      )}
    </aside>
  )
}
