'use client'

import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface HeaderProps {
  onMenuToggle: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 lg:px-8">
      {/* Mobile Menu Button */}
      <Button variant="ghost" size="icon" onClick={onMenuToggle} className="lg:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo on Mobile/Tablet */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="font-bold text-primary-foreground text-sm">P</span>
        </div>
        <span className="font-bold text-foreground text-sm">Partnership</span>
      </div>

      {/* Spacer on Desktop */}
      <div className="hidden lg:block" />

      {/* Right Side Actions */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
              EC
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="font-semibold text-foreground text-sm">Empresa Cliente</p>
            <p className="text-muted-foreground text-xs">Administrador</p>
          </div>
        </div>
      </div>
    </header>
  )
}
