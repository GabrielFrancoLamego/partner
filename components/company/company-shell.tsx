"use client"

import type React from "react"
import { useEffect, useState } from "react"
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
  Award,
  Users2,
  Target,
  Gift,
  MessagesSquare,
  UserCheck,
  Grid3x3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"
import { canManageDailyOperations, canManageFinance, canOperateFrontDesk, canConfigureCompany } from "@/lib/permissions"
import { CompanyUserProvider, type CompanyUser } from "@/lib/company-user-context"
import { TermAcceptanceGate } from "./term-acceptance-gate"
import { ProfileCompletionGate } from "./profile-completion-gate"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { UserAvatarMenu } from "./user-avatar-menu"
import { MobileNavBar } from "@/components/shared/mobile-nav-bar"
import { QuickActionBar } from "@/components/shared/quick-action-bar"

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador da Plataforma",
  COMPANY_MASTER: "Master",
  COMPANY_GERENTE: "Gerente",
  COMPANY_FINANCE: "Financeiro",
  EMPLOYEE: "Colaborador",
  PARTNER: "Parceiro",
}

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: typeof LayoutDashboard
  show: (user: CompanyUser) => boolean
  /** Item ganha um selo piscante (ver useChecklistPendingCount) quando há tarefas de checklist pendentes para o turno. */
  pulseWhenChecklistPending?: boolean
  /** Ponto e Scanner ganham destaque próprio na barra fixa inferior (ver QuickActionBar) — não duplica na barra de navegação do topo no mobile. */
  hideFromMobileNav?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/company", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  {
    href: "/company/checklists",
    label: "Checklists",
    shortLabel: "Checklist",
    icon: ListChecks,
    show: (u) => canOperateFrontDesk(u.role),
    pulseWhenChecklistPending: true,
  },
  { href: "/company/mural", label: "Mural", icon: Newspaper, show: () => true },
  {
    href: "/company/ponto",
    label: "Ponto Digital",
    shortLabel: "Ponto",
    icon: Clock,
    show: (u) => canOperateFrontDesk(u.role),
    hideFromMobileNav: true,
  },
  {
    href: "/company/scanner",
    label: "Scanner PDV",
    shortLabel: "Scanner",
    icon: ScanLine,
    show: (u) => canOperateFrontDesk(u.role),
    hideFromMobileNav: true,
  },
  { href: "/company/avaliacoes", label: "Avaliação Diária", shortLabel: "Avaliação", icon: ClipboardCheck, show: () => true },
  { href: "/company/crescimento", label: "Programa & Crescimento", shortLabel: "Crescimento", icon: Trophy, show: () => true },
  {
    href: "/company/ocorrencias",
    label: "Ocorrências",
    icon: AlertTriangle,
    show: (u) => canManageDailyOperations(u.role) || u.canRegisterOccurrences,
  },
  { href: "/company/fechamento", label: "Fechamento", icon: FileClock, show: (u) => canManageDailyOperations(u.role) },
  { href: "/company/metas", label: "Metas", icon: Target, show: () => true },
  { href: "/company/colaboradores", label: "Colaboradores", icon: Users2, show: (u) => canManageDailyOperations(u.role) },
  {
    href: "/company/mapa-pontos",
    label: "Mapa de Pontos",
    shortLabel: "Mapa",
    icon: Grid3x3,
    show: (u) => canManageDailyOperations(u.role),
  },
  { href: "/company/aprovacoes", label: "Aprovações Pendentes", shortLabel: "Aprovações", icon: UserCheck, show: (u) => u.role === "COMPANY_MASTER" },
  { href: "/company/programas", label: "Programa de Parceria", shortLabel: "Parceria", icon: Award, show: (u) => canConfigureCompany(u.role) },
  { href: "/company/promocoes", label: "Promoções", icon: Gift, show: (u) => canConfigureCompany(u.role) },
  { href: "/company/comunicacao", label: "Comunicação", icon: MessagesSquare, show: () => true },
  { href: "/company/financeiro", label: "Financeiro", icon: Wallet, show: (u) => canManageFinance(u.role) || u.isFinanceResponsible },
]

export function CompanyShell({
  user,
  children,
  billingWarning,
}: {
  user: CompanyUser
  children: React.ReactNode
  billingWarning?: { daysOverdue: number; daysRemaining: number } | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const items = NAV_ITEMS.filter((item) => item.show(user))
  const canSeeBillingWarning = user.role === "COMPANY_MASTER" || user.role === "COMPANY_FINANCE"
  const hasChecklistNavItem = items.some((i) => i.pulseWhenChecklistPending)
  const [hasPendingChecklists, setHasPendingChecklists] = useState(false)

  useEffect(() => {
    if (!hasChecklistNavItem) return
    fetch("/api/company/checklists/pending-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { count: number } | null) => setHasPendingChecklists(Boolean(data && data.count > 0)))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChecklistNavItem, pathname])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const isActive = (href: string) => (href === "/company" ? pathname === href : pathname.startsWith(href))

  return (
    <CompanyUserProvider user={user}>
      <div className="min-h-screen bg-[#F7F5F2]">
        {user.role === "EMPLOYEE" && <ProfileCompletionGate />}
        {user.role === "EMPLOYEE" && <TermAcceptanceGate />}
        {billingWarning && canSeeBillingWarning && (
          <div className="sticky top-0 z-50 bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-center">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              Pendência financeira em aberto há {billingWarning.daysOverdue}{" "}
              {billingWarning.daysOverdue === 1 ? "dia" : "dias"}. Regularize em até{" "}
              {billingWarning.daysRemaining} {billingWarning.daysRemaining === 1 ? "dia" : "dias"} para evitar o
              bloqueio do acesso.
            </span>
          </div>
        )}
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
              const pulsing = item.pulseWhenChecklistPending && hasPendingChecklists
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                    active
                      ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white shadow-md"
                      : "text-[#3E2415] hover:bg-[#F7F5F2]",
                  )}
                >
                  <span className="relative flex-shrink-0">
                    <Icon className="h-5 w-5" />
                    {pulsing && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                    )}
                  </span>
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
          <div className="flex items-center justify-between gap-3 px-4 py-2 pt-[calc(0.5rem+var(--safe-top))]">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
              <span className="font-heading text-sm font-semibold text-[#3E2415] truncate">{user.companyName}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <NotificationBell />
              <UserAvatarMenu name={user.name} roleLabel={ROLE_LABELS[user.role]} />
            </div>
          </div>
          <MobileNavBar
            items={items
              .filter((item) => !item.hideFromMobileNav)
              .map((item) => ({
                href: item.pulseWhenChecklistPending ? `${item.href}?fullscreen=1` : item.href,
                label: item.label,
                shortLabel: item.shortLabel,
                icon: item.icon,
                active: isActive(item.href),
                pulsing: item.pulseWhenChecklistPending && hasPendingChecklists,
              }))}
          />
        </div>

        {canOperateFrontDesk(user.role) && <QuickActionBar />}

        <div className="lg:ml-[260px]">
          <div className="hidden lg:flex items-center justify-end gap-3 px-8 py-3 border-b border-[#E8E3DC] bg-white/60">
            <NotificationBell />
            <UserAvatarMenu name={user.name} roleLabel={ROLE_LABELS[user.role]} />
          </div>
          <main className={cn("p-4 md:p-6 lg:p-8", canOperateFrontDesk(user.role) && "pb-24 lg:pb-8")}>{children}</main>
        </div>
      </div>
    </CompanyUserProvider>
  )
}
