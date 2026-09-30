"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Grid3x3, Star } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export type MobileNavBarItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  active: boolean
  pulsing?: boolean
}

const MAX_PINS = 5

/**
 * Barra de navegação horizontal do mobile (topo dos shells /company, /partner
 * e /admin) — mostra só os até 5 itens que o usuário fixou (ou os 5 primeiros
 * visíveis por padrão, se ele nunca customizou) + um botão "Mais" que abre um
 * seletor em tela cheia com TODOS os itens, onde dá pra navegar direto ou
 * marcar/desmarcar os favoritos (ver User.pinnedMobileNavItems).
 */
export function MobileNavBar({ items }: { items: MobileNavBarItem[] }) {
  const router = useRouter()
  const [pinned, setPinned] = useState<string[] | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [pinError, setPinError] = useState("")

  useEffect(() => {
    fetch("/api/account/mobile-nav-pins")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { pinnedMobileNavItems: string[] } | null) => setPinned(data?.pinnedMobileNavItems ?? []))
      .catch(() => setPinned([]))
  }, [])

  const visibleItems = pinned && pinned.length > 0 ? items.filter((i) => pinned.includes(i.href)) : items.slice(0, MAX_PINS)

  const togglePin = async (href: string) => {
    setPinError("")
    const current = pinned ?? items.slice(0, MAX_PINS).map((i) => i.href)
    const isPinned = current.includes(href)
    if (!isPinned && current.length >= MAX_PINS) {
      setPinError(`Você já tem ${MAX_PINS} itens em destaque — remova um antes de adicionar outro.`)
      return
    }
    const next = isPinned ? current.filter((h) => h !== href) : [...current, href]
    setPinned(next)
    await fetch("/api/account/mobile-nav-pins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinnedMobileNavItems: next }),
    }).catch(() => {})
  }

  return (
    <>
      <div
        className="flex gap-1.5 overflow-x-auto whitespace-nowrap px-3 pb-2 scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x", overscrollBehaviorX: "contain" } as React.CSSProperties}
      >
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 min-w-[60px] text-center transition-colors",
              item.active ? "bg-[#3E2415] text-white" : "bg-[#F7F5F2] text-[#3E2415]",
            )}
          >
            <span className="relative">
              <item.icon className="h-5 w-5" />
              {item.pulsing && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{item.shortLabel ?? item.label}</span>
          </Link>
        ))}

        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 min-w-[60px] text-center border-2 border-dashed border-[#E8E3DC] text-[#3E2415]/70"
        >
          <Grid3x3 className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-tight whitespace-nowrap">Mais</span>
        </button>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Todos os itens do menu</SheetTitle>
            <p className="text-xs text-gray-500">
              Toque num item para acessar. Toque na estrela para fixar até {MAX_PINS} favoritos na barra rápida.
            </p>
            {pinError && <p className="text-xs text-red-600">{pinError}</p>}
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 px-4 overflow-y-auto" style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}>
            {items.map((item) => {
              const isPinned = (pinned ?? []).includes(item.href)
              return (
                <div
                  key={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-center border",
                    item.active ? "bg-[#3E2415] text-white border-[#3E2415]" : "bg-[#F7F5F2] text-[#3E2415] border-transparent",
                  )}
                >
                  <button
                    onClick={() => togglePin(item.href)}
                    className={cn(
                      "absolute top-1.5 right-1.5 rounded-full p-1",
                      isPinned ? "text-[#FB9C08]" : item.active ? "text-white/50" : "text-gray-300",
                    )}
                    aria-label={isPinned ? "Remover dos favoritos" : "Fixar como favorito"}
                  >
                    <Star className="h-4 w-4" fill={isPinned ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      router.push(item.href)
                    }}
                    className="flex flex-col items-center gap-1.5 w-full pt-2"
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-[11px] font-medium leading-tight">{item.shortLabel ?? item.label}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
