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
  FileText,
  HeadphonesIcon,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileBottomNavProps {
  activeMenu: string
  setActiveMenu: (menu: string) => void
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
  { id: "Scanner QR", label: "Scanner", icon: QrCode, roles: ["admin", "partner", "colaborador"] },
  { id: "Comissões", label: "Comissões", icon: Wallet, roles: ["admin", "partner", "colaborador"] },
  { id: "Parceiros", label: "Parceiros", icon: UsersRound, roles: ["admin", "partner"] },
  { id: "Usuários", label: "Usuários", icon: Users, roles: ["admin"] },
  { id: "Relatórios", label: "Relatórios", icon: FileText, roles: ["admin", "partner"] },
  { id: "Suporte", label: "Suporte", icon: HeadphonesIcon, roles: ["partner"] },
]

export function MobileBottomNav({ activeMenu, setActiveMenu, isLoggedIn, userType, onLogout }: MobileBottomNavProps) {
  if (!isLoggedIn) return null

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(userType || ""))

  const handleLogoutClick = () => {
    onLogout()
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom))] overflow-x-auto scrollbar-hide">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeMenu === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[70px]",
                isActive
                  ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-heading text-xs font-medium whitespace-nowrap">{item.label}</span>
            </button>
          )
        })}
        <button
          onClick={handleLogoutClick}
          className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[70px] text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-heading text-xs font-medium whitespace-nowrap">Sair</span>
        </button>
      </div>
    </nav>
  )
}
