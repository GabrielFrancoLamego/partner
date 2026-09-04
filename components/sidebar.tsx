'use client'

import { cn } from '@/lib/utils'
import { LayoutDashboard, Building2, Layers, Tag, UserPlus, QrCode, DollarSign, Wallet, Users, Palette, FileText, HelpCircle, LogOut, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  className?: string
  onClose?: () => void
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '#dashboard' },
  { icon: Building2, label: 'Unidades', href: '#unidades' },
  { icon: Layers, label: 'Programas', href: '#programas' },
  { icon: Tag, label: 'Promoções', href: '#promocoes' },
  { icon: UserPlus, label: 'Indicações', href: '#indicacoes' },
  { icon: QrCode, label: 'Scanner QR', href: '#scanner' },
  { icon: DollarSign, label: 'Comissões', href: '#comissoes' },
  { icon: Wallet, label: 'Saques', href: '#saques' },
  { icon: Users, label: 'Parceiros', href: '#parceiros' },
  { icon: Palette, label: 'Aparência', href: '#aparencia' },
  { icon: FileText, label: 'Relatórios', href: '#relatorios' },
]

export function Sidebar({ className, onClose }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-[260px] flex-col border-r border-sidebar-border bg-sidebar shadow-lg',
        className
      )}
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
        <div className="flex items-center gap-3">
          <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <h1 className="font-heading font-semibold tracking-[-0.035em] text-sidebar-foreground text-sm">Tribuss</h1>
            <p className="text-sidebar-foreground/60 text-xs">White Label</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {menuItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-primary active:text-primary-foreground"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-heading font-medium text-sm">{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="border-t border-sidebar-border p-4 space-y-1">
        <a
          href="#suporte"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="font-medium text-sm">Suporte</span>
        </a>
        <button
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sidebar-foreground/70 transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}
