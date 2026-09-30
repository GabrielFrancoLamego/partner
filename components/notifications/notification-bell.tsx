"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { playEarningsSound } from "@/lib/earnings-sound"

type Notification = {
  id: string
  type: string
  title: string
  message: string
  linkUrl: string | null
  whatsappUrl: string | null
  readAt: string | null
  createdAt: string
}

const EARNINGS_NOTIFICATION_TYPES = new Set(["COMMISSION_EARNED", "BONUS_AWARDED"])

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "agora"
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Sino de notificações — disponível para qualquer role logada (Admin/Empresa/Parceiro). */
export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const seenIds = useRef<Set<string> | null>(null)
  const soundEnabled = useRef(true)

  const reload = () => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const list = data.notifications as Notification[]

        if (seenIds.current) {
          const newEarnings = list.some((n) => !seenIds.current!.has(n.id) && EARNINGS_NOTIFICATION_TYPES.has(n.type))
          if (newEarnings && soundEnabled.current) playEarningsSound()
        }
        seenIds.current = new Set(list.map((n) => n.id))

        setNotifications(list)
        setUnreadCount(data.unreadCount)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetch("/api/account/notification-preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) soundEnabled.current = Boolean(data.soundOnEarnings)
      })
      .catch(() => {})

    reload()
    const interval = setInterval(reload, 60000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && unreadCount > 0) {
      fetch("/api/notifications", { method: "PATCH" }).then(() => setUnreadCount(0))
    }
  }

  const handleClick = (n: Notification) => {
    setIsOpen(false)
    if (n.linkUrl) router.push(n.linkUrl)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gray-400">Nenhuma notificação ainda.</p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleClick(n)}
              className="flex-col items-start gap-0.5 whitespace-normal py-2"
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className={n.readAt ? "font-medium text-gray-600" : "font-semibold text-[#3E2415]"}>{n.title}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
              {n.whatsappUrl && (
                <a
                  href={n.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] text-green-700 mt-0.5 hover:underline"
                >
                  <MessageCircle className="h-3 w-3" /> Enviar por WhatsApp
                </a>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
