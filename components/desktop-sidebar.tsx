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
  userType: "admin" | "partner" | "colaborador" | null
  onLogout: () => void
}

const menuItems = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "partner", "colaborador"] },
  { id: "Unidades", label: "Unidades", icon: Building2, roles: ["admin", "partner"] },
  { id: "Programas", label: "Programas", icon: Boxes, roles: ["admin", "partner"] },
  { id: "Promoções", label: "Promoções", icon: Tag, roles: ["admin", "partner", "colaborador"] },
  { id: "Indicações", label: "Indicações", icon: Users, roles: ["admin", "partner", "colaborador"] },
  { id: "Scanner QR", label: "Scanner QR", icon: QrCode, roles: ["admin", "partner", "colaborador"] },
  { id: "Comissões", label: "Comissões", icon: Wallet, roles: ["admin", "partner", "colaborador"] },
  { id: "Parceiros", label: "Parceiros", icon: UsersRound, roles: ["admin", "partner"] },
  { id: "Usuários", label: "Usuários", icon: Users, roles: ["admin"] },
  { id: "Relatórios", label: "Relatórios", icon: FileText, roles: ["admin", "partner"] },
  { id: "Suporte", label: "Suporte", icon: HeadphonesIcon, roles: ["partner"] },
]

export function DesktopSidebar({
  activeMenu,
  setActiveMenu,
  onCustomizeClick,
  sidebarBg = "#FFFFFF",
  sidebarText = "#3E2415",
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
      className="hidden lg:flex fixed left-0 top-0 h-screen w-[260px] flex-col border-r border-[#E8E3DC] shadow-sm"
      style={{ backgroundColor: sidebarBg }}
    >
      <div className="p-4 border-b border-[#E8E3DC]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl || "/placeholder.svg"} alt="Logo" className="w-10 h-10 rounded-xl object-contain" />
            ) : (
              <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-10 h-10 rounded-xl object-contain" />
            )}
            <div>
              <h2 className="font-heading text-base font-semibold tracking-[-0.035em]" style={{ color: sidebarText }}>
                Tribuss
              </h2>
              <p className="text-xs" style={{ color: sidebarText, opacity: 0.6 }}>
                Plataforma
              </p>
            </div>
          </div>

          {isLoggedIn && (
            <button
              onClick={onCustomizeClick}
              className="p-2 hover:bg-[#E8E3DC] rounded-lg transition-colors"
              title="Personalizar"
            >
              <Paintbrush className="w-4 h-4" style={{ color: sidebarText }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeMenu === item.id

            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                  isActive
                    ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white shadow-md"
                    : "hover:bg-[#E8E3DC]",
                )}
                style={!isActive ? { color: sidebarText } : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-heading text-sm font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoggedIn && (
        <div className="border-t border-[#E8E3DC] p-3 space-y-1">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left hover:bg-[#E8E3DC]"
            style={{ color: sidebarText }}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="font-heading text-sm font-medium">Sair</span>
          </button>
        </div>
      )}
    </aside>
  )
}
