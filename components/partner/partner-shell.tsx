"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Wallet, Banknote, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { PartnerUserProvider, type PartnerUser } from "@/lib/partner-user-context"
import { PartnerTermAcceptanceGate } from "./term-acceptance-gate"

const NAV_ITEMS = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/comissoes", label: "Comissões", icon: Wallet },
  { href: "/partner/saques", label: "Saques PIX", icon: Banknote },
]

export function PartnerShell({ user, children }: { user: PartnerUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const isActive = (href: string) => (href === "/partner" ? pathname === href : pathname.startsWith(href))

  return (
    <PartnerUserProvider user={user}>
      <div className="min-h-screen bg-[#F7F5F2]">
        <PartnerTermAcceptanceGate />
        <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[260px] flex-col border-r border-[#E8E3DC] bg-white">
          <div className="p-4 border-b border-[#E8E3DC] flex items-center gap-3">
            <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <h2 className="font-heading text-base font-semibold tracking-[-0.035em] text-[#3E2415]">Tribuss</h2>
              <p className="text-xs text-[#3E2415]/60">Portal do Parceiro</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                    active
                      ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white shadow-md"
                      : "text-[#3E2415] hover:bg-[#F7F5F2]",
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-heading">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-[#E8E3DC] p-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#3E2415] hover:bg-[#F7F5F2] transition-colors"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="font-heading">Sair</span>
            </button>
          </div>
        </aside>

        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#E8E3DC]">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2">
              <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-heading text-sm font-semibold text-[#3E2415]">Portal do Parceiro</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#3E2415] hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-hide">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    active ? "bg-[#3E2415] text-white" : "bg-[#F7F5F2] text-[#3E2415]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="lg:ml-[260px]">
          <div className="hidden lg:flex items-center justify-end px-8 py-3 border-b border-[#E8E3DC] bg-white/60">
            <p className="text-xs text-gray-500">
              Logado como <span className="font-semibold text-[#3E2415]">{user.name}</span>
            </p>
          </div>
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </PartnerUserProvider>
  )
}
