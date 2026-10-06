"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Wallet, LogOut, Gift, Map, MessagesSquare, Star, Rocket, Compass, Plus, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { PartnerUserProvider, type PartnerUser } from "@/lib/partner-user-context"
import { PartnerTermAcceptanceGate } from "./term-acceptance-gate"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { RatingPromptModal } from "./rating-prompt-modal"
import { MobileNavBar } from "@/components/shared/mobile-nav-bar"
import { PartnerAvatarMenu } from "./partner-avatar-menu"
import { FloatingHelpChat } from "./floating-help-chat"
import { GenerateVoucherDialog, GENERATE_VOUCHER_EVENT, type GenerateVoucherPreset } from "./generate-voucher-dialog"

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: typeof LayoutDashboard
  show?: (user: PartnerUser) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/explorar", label: "Explorar Programas", shortLabel: "Explorar", icon: Compass },
  { href: "/partner/nivel", label: "Meu Nível", icon: Rocket },
  { href: "/partner/comissoes", label: "Comissões & Saques", shortLabel: "Comissões", icon: Wallet },
  { href: "/partner/afiliado", label: "Rede de Afiliados", shortLabel: "Afiliado", icon: Star, show: (u) => u.isAffiliate },
  { href: "/partner/promocoes", label: "Promoções", icon: Gift },
  { href: "/partner/mapa", label: "Mapa", icon: Map },
  { href: "/partner/ajuda", label: "Ajuda", icon: MessagesSquare },
]

const BOTTOM_ITEMS = [
  { href: "/partner", label: "Início", icon: LayoutDashboard },
  { href: "/partner/promocoes", label: "Promoções", icon: Gift },
  { href: "/partner/comissoes", label: "Comissões", icon: Wallet },
  { href: "/partner/mapa", label: "Mapa", icon: Map },
]

function BottomLink({ item, active }: { item: (typeof BOTTOM_ITEMS)[number]; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium", active ? "text-[#F2680C]" : "text-[#3E2415]/70")}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  )
}

export function PartnerShell({ user, children }: { user: PartnerUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [voucherPreset, setVoucherPreset] = useState<GenerateVoucherPreset | undefined>()

  // Outras telas (ex: "Enviar ao Cliente" numa promoção) abrem o gerador já com estabelecimento/promoção.
  useEffect(() => {
    const open = (event: Event) => {
      setVoucherPreset((event as CustomEvent<GenerateVoucherPreset | undefined>).detail)
      setVoucherOpen(true)
    }
    window.addEventListener(GENERATE_VOUCHER_EVENT, open)
    return () => window.removeEventListener(GENERATE_VOUCHER_EVENT, open)
  }, [])
  const openVoucher = () => {
    setVoucherPreset(undefined)
    setVoucherOpen(true)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const isActive = (href: string) => (href === "/partner" ? pathname === href : pathname.startsWith(href))
  const items = NAV_ITEMS.filter((item) => !item.show || item.show(user))

  return (
    <PartnerUserProvider user={user}>
      <div className="min-h-screen bg-[#F7F5F2]">
        <PartnerTermAcceptanceGate />
        <RatingPromptModal />
        <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[260px] flex-col border-r border-[#E8E3DC] bg-white">
          <div className="p-4 border-b border-[#E8E3DC] flex items-center gap-3">
            <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <h2 className="font-heading text-base font-semibold tracking-[-0.035em] text-[#3E2415]">Tribuss</h2>
              <p className="text-xs text-[#3E2415]/60">Portal do Parceiro</p>
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

        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#E8E3DC]">
          <div className="flex items-center justify-between gap-3 px-4 py-2 pt-[calc(0.5rem+var(--safe-top))]">
            <div className="flex items-center gap-2">
              <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-heading text-sm font-semibold text-[#3E2415]">Portal do Parceiro</span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <PartnerAvatarMenu name={user.name} photoUrl={photoUrl} onPhotoUpdated={setPhotoUrl} />
            </div>
          </div>
          <MobileNavBar
            items={items.map((item) => ({
              href: item.href,
              label: item.label,
              shortLabel: item.shortLabel,
              icon: item.icon,
              active: isActive(item.href),
            }))}
          />
        </div>

        <div className="lg:ml-[260px]">
          <div className="hidden lg:flex items-center justify-end gap-3 px-8 py-3 border-b border-[#E8E3DC] bg-white/60">
            <button
              onClick={openVoucher}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF1F6B] to-[#FF7A00] px-4 py-2 text-sm font-bold text-white shadow-md hover:opacity-95"
            >
              <Plus className="h-4 w-4" /> GERAR VOUCHER
            </button>
            <NotificationBell />
            <PartnerAvatarMenu name={user.name} photoUrl={photoUrl} onPhotoUpdated={setPhotoUrl} />
          </div>
          <main className="p-4 md:p-6 lg:p-8 pb-32 lg:pb-8 overflow-x-hidden">{children}</main>
        </div>

        {/* Barra inferior (mobile/PWA): atalhos + botão central em destaque [+ GERAR VOUCHER] */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#E8E3DC] bg-white pb-[var(--safe-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]" aria-label="Atalhos">
          <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1">
            {BOTTOM_ITEMS.slice(0, 2).map((item) => (
              <BottomLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
            <div className="flex justify-center">
              <button
                onClick={openVoucher}
                className="-mt-6 mb-2 flex min-h-14 w-[6.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-gradient-to-br from-[#FF1F6B] to-[#FF7A00] text-white shadow-xl ring-4 ring-white active:scale-95 transition-transform"
                aria-label="Gerar voucher"
              >
                <span className="flex items-center gap-1 text-lg font-extrabold leading-none">
                  <Plus className="h-5 w-5" strokeWidth={3} />
                  <Ticket className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-extrabold leading-none tracking-wide">GERAR VOUCHER</span>
              </button>
            </div>
            {BOTTOM_ITEMS.slice(2).map((item) => (
              <BottomLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        </nav>

        <GenerateVoucherDialog open={voucherOpen} onOpenChange={setVoucherOpen} preset={voucherPreset} />

        <FloatingHelpChat />
      </div>
    </PartnerUserProvider>
  )
}
