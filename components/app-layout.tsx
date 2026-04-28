'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { Header } from '@/components/header'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Fixed Left */}
      <Sidebar className="hidden lg:flex" />

      {/* Main Content Area */}
      <div className="lg:ml-[260px]">
        {/* Header */}
        <Header onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        {/* Main Content */}
        <main className="p-4 pb-24 lg:p-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav className="lg:hidden" />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-[280px] bg-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar className="flex" onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
