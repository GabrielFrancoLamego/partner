"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Newspaper,
  AlertTriangle,
  ClipboardCheck,
  Trophy,
  Clock,
  ListChecks,
  ScanLine,
  Wallet,
  LogOut,
  FileClock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"
import { canManageDailyOperations, canManageFinance, canOperateFrontDesk } from "@/lib/permissions"
import { CompanyUserProvider, type CompanyUser } from "@/lib/company-user-context"

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador da Plataforma",
  COMPANY_MASTER: "Master",
  COMPANY_GERENTE: "Gerente",
  COMPANY_FINANCE: "Financeiro",
  EMPLOYEE: "Colaborador",
  PARTNER: "Parceiro",
}

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; show: (user: CompanyUser) => boolean }

const NAV_ITEMS: NavItem[] = [
  { href: "/company", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { href: "/company/mural", label: "Mural", icon: Newspaper, show: () => true },
  { href: "/company/ponto", label: "Ponto Digital", icon: Clock, show: (u) => canOperateFrontDesk(u.role) },
  { href: "/company/checklists", label: "Checklists", icon: ListChecks, show: (u) => canOperateFrontDesk(u.role) },
  { href: "/company/pdv", label: "Scanner PDV", icon: ScanLine, show: (u) => canOperateFrontDesk(u.role) },
  { href: "/company/avaliacoes", label: "Avaliação Diária", icon: ClipboardCheck, show: () => true },
  { href: "/company/crescimento", label: "Crescimento", icon: Trophy, show: () => true },
  {
    href: "/company/ocorrencias",
    label: "Ocorrências",
    icon: AlertTriangle,
    show: (u) => canManageDailyOperations(u.role) || u.canRegisterOccurrences,
  },
  { href: "/company/fechamento", label: "Fechamento", icon: FileClock, show: (u) => canManageDailyOperations(u.role) },
  { href: "/company/financeiro", label: "Financeiro", icon: Wallet, show: (u) => canManageFinance(u.role) },
]

export function CompanyShell({ user, children }: { user: CompanyUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = NAV_ITEMS.filter((item) => item.show(user))

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const isActive = (href: string) => (href === "/company" ? pathname === href : pathname.startsWith(href))

  return (
    <CompanyUserProvider user={user}>
      <div className="min-h-screen bg-[#F7F5F2]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[260px] flex-col border-r border-[#E8E3DC] bg-white">
          <div className="p-4 border-b border-[#E8E3DC] flex items-center gap-3">
            <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-10 h-10 rounded-xl object-contain" />
            <div className="min-w-0">
              <h2 className="font-heading text-base font-semibold tracking-[-0.035em] text-[#3E2415] truncate">
                {user.companyName}
              </h2>
              <p className="text-xs text-[#3E2415]/60">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {items.map((item) => {
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

        {/* Mobile top bar + section tabs */}
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#E8E3DC]">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
              <span className="font-heading text-sm font-semibold text-[#3E2415] truncate">{user.companyName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#3E2415] hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-hide">
            {items.map((item) => {
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
              Logado como <span className="font-semibold text-[#3E2415]">{user.name}</span> ·{" "}
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </CompanyUserProvider>
  )
}
