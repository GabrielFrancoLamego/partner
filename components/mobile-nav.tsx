'use client'

import { cn } from '@/lib/utils'
import { LayoutDashboard, Building2, Layers, Tag, UserPlus, QrCode, DollarSign, Wallet, Users, Palette, FileText, HelpCircle, LogOut } from 'lucide-react'

interface MobileNavProps {
  className?: string
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Building2, label: 'Unidades' },
  { icon: Layers, label: 'Programas' },
  { icon: Tag, label: 'Promoções' },
  { icon: UserPlus, label: 'Indicações' },
  { icon: QrCode, label: 'Scanner' },
  { icon: DollarSign, label: 'Comissões' },
  { icon: Wallet, label: 'Saques' },
  { icon: Users, label: 'Parceiros' },
  { icon: Palette, label: 'Aparência' },
  { icon: FileText, label: 'Relatórios' },
  { icon: HelpCircle, label: 'Suporte' },
  { icon: LogOut, label: 'Sair' },
]

export function MobileNav({ className }: MobileNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-sidebar-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80',
        className
      )}
    >
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        {navItems.map((item, index) => (
          <button
            key={item.label}
            className={cn(
              'flex flex-shrink-0 flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all',
              index === 0
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-sidebar-accent/50 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium text-xs whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
